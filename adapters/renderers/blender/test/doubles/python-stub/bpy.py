# W068 (ACR-011) — the MINIMAL honest `bpy` STUB for the CI sidecar-Python
# guard (test/sidecar-python.test.ts).
#
# This is NOT Blender: it is a tiny double of the exact `bpy` slice the
# pinned sidecar script uses, so the STANDARD CI battery can EXECUTE the
# emitted sidecar Python through the ok render/export paths with NO Blender
# binary and NO new dependencies — real python3 process, real workspace
# files, real digests; only `bpy` itself is doubled. The pattern is the
# committed Node CLI double (test/doubles/blender-double.mjs) applied one
# level deeper, with the same honesty rules: the stub identifies itself in
# every report it contributes to (`bpy.app.version_string` below says
# "epoch-python-stub", never "Blender") and its "render" is a deterministic
# labeled byte artifact, never pixels.
#
# Injected ONLY via PYTHONPATH by the guard battery. Never imported by any
# Epoch TypeScript code.

import json


class _App:
    # Honest identity: never claims to be a real Blender build.
    version_string = "4.2.11-epoch-python-stub"


class _DefaultValue:
    def __init__(self):
        self.default_value = None


class _NodeInputs:
    def __init__(self):
        self._values = {}

    def __getitem__(self, key):
        if key not in self._values:
            self._values[key] = _DefaultValue()
        return self._values[key]


class _Node:
    def __init__(self, name):
        self.name = name
        self.inputs = _NodeInputs()


class _Nodes:
    def __init__(self):
        self._nodes = {"Principled BSDF": _Node("Principled BSDF")}

    def get(self, name):
        return self._nodes.get(name)


class _NodeTree:
    def __init__(self):
        self.nodes = _Nodes()


class _Material:
    def __init__(self, name):
        self.name = name
        self.use_nodes = False
        self.node_tree = _NodeTree()


class _Materials:
    def new(self, name):
        return _Material(name)


class _LightData:
    def __init__(self, name, type):
        self.name = name
        self.type = type


class _Lights:
    def new(self, name, type):
        return _LightData(name, type)


class _CameraData:
    def __init__(self, name):
        self.name = name


class _Cameras:
    def new(self, name):
        return _CameraData(name)


class _MeshData:
    def __init__(self):
        self.materials = []


class _Object:
    def __init__(self, name, data):
        self.name = name
        self.data = data
        self.location = (0.0, 0.0, 0.0)
        self.rotation_euler = (0.0, 0.0, 0.0)
        self._custom_properties = {}

    def __setitem__(self, key, value):
        self._custom_properties[key] = value

    def __getitem__(self, key):
        return self._custom_properties[key]


class _Objects:
    def new(self, name, object_data):
        return _Object(name, object_data)


class _Data:
    def __init__(self):
        self.materials = _Materials()
        self.lights = _Lights()
        self.cameras = _Cameras()
        self.objects = _Objects()


class _CollectionObjects:
    def __init__(self):
        self.linked = []

    def link(self, obj):
        self.linked.append(obj)


class _Collection:
    def __init__(self):
        self.objects = _CollectionObjects()


class _ImageSettings:
    def __init__(self):
        self.file_format = "PNG"


class _RenderSettings:
    def __init__(self):
        self.filepath = ""
        self.image_settings = _ImageSettings()
        self.resolution_x = 640
        self.resolution_y = 480
        self.engine = "CYCLES"


class _Cycles:
    def __init__(self):
        self.samples = 16


class _Scene:
    def __init__(self):
        self.camera = None
        self.render = _RenderSettings()
        self.cycles = _Cycles()


class _Context:
    def __init__(self):
        self.collection = _Collection()
        self.scene = _Scene()
        self.active_object = None


_context = _Context()


def _entity_ids():
    ids = []
    for obj in _context.collection.objects.linked:
        if "epochEntityId" in obj._custom_properties:
            ids.append(obj._custom_properties["epochEntityId"])
    return sorted(ids)


class _WmOps:
    @staticmethod
    def read_factory_settings(use_empty=False):
        pass


class _MeshOps:
    def _add(self, obj, location):
        obj.location = tuple(location)
        _context.collection.objects.link(obj)
        _context.active_object = obj

    def primitive_cube_add(self, size=1.0, location=(0.0, 0.0, 0.0)):
        self._add(_Object("Cube", _MeshData()), location)

    def primitive_uv_sphere_add(self, radius=1.0, location=(0.0, 0.0, 0.0)):
        self._add(_Object("Sphere", _MeshData()), location)


class _RenderOps:
    @staticmethod
    def render(write_still=False):
        # The deterministic "render": a labeled byte artifact (honestly NOT
        # a real PNG — the same convention as the Node CLI double; the
        # boundary evidence under test is the report shape + the
        # digest-addressed artifact, not rasterization).
        render = _context.scene.render
        payload = {
            "kind": "epoch-python-stub-image",
            "entityIds": _entity_ids(),
            "width": render.resolution_x,
            "height": render.resolution_y,
        }
        artifact = b"EPOCH-PYTHON-STUB-IMAGE\n" + json.dumps(payload).encode("utf-8")
        with open(render.filepath, "wb") as handle:
            handle.write(artifact)


class _ExportSceneOps:
    @staticmethod
    def gltf(filepath, export_format="GLB"):
        payload = {
            "kind": "epoch-python-stub-glb",
            "entityIds": _entity_ids(),
            "exportFormat": export_format,
        }
        artifact = b"glTF" + b"EPOCH-PYTHON-STUB-GLB\n" + json.dumps(payload).encode("utf-8")
        with open(filepath, "wb") as handle:
            handle.write(artifact)


class _Ops:
    wm = _WmOps()
    mesh = _MeshOps()
    render = _RenderOps()
    export_scene = _ExportSceneOps()


app = _App()
data = _Data()
context = _context
ops = _Ops()
