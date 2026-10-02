/**
 * The BLENDER SIDECAR SCRIPT (W060) — the Python program Epoch runs INSIDE
 * Blender's background mode. It is DATA of this package (a pinned string
 * with a recorded digest), written into the scoped workspace at run time:
 *
 *   blender --background --factory-startup --python blender-sidecar.py -- \
 *       <job-spec.json> <report.json>
 *
 * The sidecar is a DUMB EXECUTOR of the typed job protocol (see jobs.ts):
 * it reads ONE job spec, executes exactly the declared job kind (version
 * probe / offscene render / glTF export), and writes ONE typed JSON report.
 * It never reads environment secrets, never touches files outside the two
 * paths it was given, and always writes a report (ok or typed error) so the
 * adapter's failure paths stay exercised. Its self-reported sizes/digests
 * are UNTRUSTED: the adapter re-computes them (workspace.readVerifiedArtifact).
 *
 * Blender is invoked as a SEPARATE PROGRAM — this script is handed to
 * Blender's own interpreter; no Epoch code links against or embeds Blender
 * (the GPL separate-executable posture recorded in docs/rendering/blender.md).
 */
import { sha256Hex } from '@epoch/agent-protocol';

/** The sidecar Python source (pinned; executed inside Blender only). */
export const BLENDER_SIDECAR_PYTHON = `# Epoch Blender sidecar (W060, ACR-007/X2.0).
# Runs inside Blender's background mode:
#   blender --background --factory-startup --python blender-sidecar.py -- <job.json> <report.json>
# Dumb executor of the typed job protocol: one job in, one typed report out.
import hashlib
import json
import sys


def write_report(report_path, report):
    with open(report_path, "w", encoding="utf-8") as handle:
        json.dump(report, handle)


def file_info(path):
    with open(path, "rb") as handle:
        data = handle.read()
    return {"byteSize": len(data), "digest": hashlib.sha256(data).hexdigest()}


def fail(report_path, job_id, error_code, message):
    write_report(report_path, {"ok": False, "jobId": job_id, "errorCode": error_code, "message": message})


def require(condition, report_path, job_id, error_code, message):
    if not condition:
        fail(report_path, job_id, error_code, message)
        sys.exit(0)


def build_scene(entities, camera_spec):
    import bpy
    import mathutils

    bpy.ops.wm.read_factory_settings(use_empty=True)
    for entity in entities:
        primitive = entity.get("primitive", "box")
        size = float(entity.get("size", 1.0))
        position = tuple(float(v) for v in entity.get("position", [0.0, 0.0, 0.0]))
        if primitive == "sphere":
            bpy.ops.mesh.primitive_uv_sphere_add(radius=size / 2.0, location=position)
        else:
            bpy.ops.mesh.primitive_cube_add(size=size, location=position)
        obj = bpy.context.active_object
        obj.name = entity.get("label") or entity.get("entityId", "entity")
        # Semantic identity rides the object as a custom property (presentation
        # provenance ONLY — never Epoch semantic authority).
        obj["epochEntityId"] = entity["entityId"]
        color = entity.get("color")
        if color:
            material = bpy.data.materials.new(name="mat-" + entity["entityId"])
            material.use_nodes = True
            bsdf = material.node_tree.nodes.get("Principled BSDF")
            if bsdf:
                bsdf.inputs["Base Color"].default_value = (
                    float(color[0]),
                    float(color[1]),
                    float(color[2]),
                    1.0,
                )
            obj.data.materials.append(material)
    camera_position = tuple(float(v) for v in camera_spec.get("position", [10.0, -10.0, 10.0]))
    target = tuple(float(v) for v in camera_spec.get("target", [0.0, 0.0, 0.0]))
    light_data = bpy.data.lights.new(name="epoch-light", type="SUN")
    light = bpy.data.objects.new(name="epoch-light", object_data=light_data)
    bpy.context.collection.objects.link(light)
    camera_data = bpy.data.cameras.new(name="epoch-camera")
    camera = bpy.data.objects.new(name="epoch-camera", object_data=camera_data)
    bpy.context.collection.objects.link(camera)
    camera.location = camera_position
    direction = mathutils.Vector(target) - mathutils.Vector(camera_position)
    camera.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()
    light.location = camera_position
    bpy.context.scene.camera = camera


def main():
    argv = sys.argv
    require("--" in argv, "", "sidecar-error", "the sidecar requires Blender's -- separator")
    args = argv[argv.index("--") + 1:]
    require(len(args) == 2, "", "sidecar-error", "the sidecar takes exactly two paths after --")
    job_path, report_path = args
    try:
        with open(job_path, "r", encoding="utf-8") as handle:
            job = json.load(handle)
    except Exception as exc:  # noqa: BLE001 - typed report, never a crash
        fail(report_path, "", "job-invalid", "the job spec is not readable JSON: " + str(exc))
        sys.exit(0)
    job_id = job.get("jobId", "")
    job_kind = job.get("jobKind", "")
    try:
        if job_kind == "probe":
            import bpy

            write_report(
                report_path,
                {
                    "ok": True,
                    "jobId": job_id,
                    "jobKind": "probe",
                    "blenderVersion": bpy.app.version_string,
                    "entityCount": 0,
                },
            )
        elif job_kind == "render-offscene":
            scene = job.get("scene")
            require(isinstance(scene, dict), report_path, job_id, "job-invalid", "the render job carries no scene")
            output = job.get("output")
            require(isinstance(output, dict), report_path, job_id, "job-invalid", "the render job carries no output")
            entities = scene.get("entities", [])
            camera = scene.get("camera", {})
            build_scene(entities, camera)
            import bpy

            render = bpy.context.scene.render
            render.filepath = output["path"]
            render.image_settings.file_format = "PNG"
            render.resolution_x = int(output.get("width", 640))
            render.resolution_y = int(output.get("height", 480))
            bpy.context.scene.cycles.samples = 16
            bpy.context.scene.render.engine = "CYCLES"
            bpy.ops.render.render(write_still=True)
            write_report(
                report_path,
                {
                    "ok": True,
                    "jobId": job_id,
                    "jobKind": "render-offscene",
                    "entityCount": len(entities),
                    "image": file_info(output["path"]),
                },
            )
        elif job_kind == "export-gltf":
            scene = job.get("scene")
            require(isinstance(scene, dict), report_path, job_id, "job-invalid", "the export job carries no scene")
            output = job.get("output")
            require(isinstance(output, dict), report_path, job_id, "job-invalid", "the export job carries no output")
            entities = scene.get("entities", [])
            camera = scene.get("camera", {})
            build_scene(entities, camera)
            import bpy

            bpy.ops.export_scene.gltf(filepath=output["path"], export_format="GLB")
            write_report(
                report_path,
                {
                    "ok": True,
                    "jobId": job_id,
                    "jobKind": "export-gltf",
                    "entityCount": len(entities),
                    "glb": file_info(output["path"]),
                },
            )
        else:
            fail(report_path, job_id, "job-unsupported", "unknown job kind: " + str(job_kind))
    except SystemExit:
        raise
    except Exception as exc:  # noqa: BLE001 - every failure is a typed report
        fail(report_path, job_id, "sidecar-error", str(exc))


main()
`;

/** The pinned digest of the sidecar source (provenance anchor). */
export const BLENDER_SIDECAR_PYTHON_DIGEST: string = sha256Hex(BLENDER_SIDECAR_PYTHON);

/** The workspace file name of the sidecar (a strict slug). */
export const SIDECAR_FILE_ID = 'blender-sidecar';
