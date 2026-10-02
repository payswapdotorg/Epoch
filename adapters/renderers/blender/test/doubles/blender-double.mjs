#!/usr/bin/env node
// W060 — the Blender CLI TEST DOUBLE (CI evidence without Blender).
//
// This is a Node program that EMULATES the small slice of the `blender`
// CLI the adapter's typed boundary invokes:
//
//   blender --version
//   blender --background --factory-startup --python <sidecar.py> -- <job.json> <report.json>
//
// It implements the SIDECAAR JOB PROTOCOL's honest semantics in JavaScript
// (version probe, offscene render artifact, glTF/GLB export) so the REAL
// spawn boundary, the REAL workspace discipline, and the REAL report/
// artifact verification run in CI — only Blender itself is doubled. It is
// NOT Blender and never claims to be: the version string says so, and the
// rendered "image" is a deterministic labeled byte artifact, not pixels.
//
// Misbehavior modes (env BLENDER_DOUBLE_MODE) exercise the boundary's
// negative paths: 'timeout' (hang), 'flood-stdout' (output-cap kill),
// 'fail-exit' (non-zero exit), 'garbage-report' (invalid JSON report),
// 'no-report' (silent success), 'wrong-job' (report answers another job),
// 'artifact-lies' (report digest does not match the artifact bytes).

import { createHash } from 'node:crypto';
import fs from 'node:fs';

const mode = process.env.BLENDER_DOUBLE_MODE ?? 'ok';
const args = process.argv.slice(2);

const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function fail(message, code = 1) {
  process.stderr.write(`blender-double: ${message}\n`);
  process.exit(code);
}

// --- misbehavior modes apply to EVERY invocation shape (they exist to
// exercise the boundary's negative paths, including --version probes). ---
if (mode === 'timeout') {
  await sleep(30_000);
  process.exit(0);
}
if (mode === 'flood-stdout') {
  const chunk = 'x'.repeat(64 * 1024);
  for (let i = 0; i < 64; i += 1) {
    process.stdout.write(chunk);
  }
  await sleep(5_000);
  process.exit(0);
}
if (mode === 'fail-exit') {
  process.stderr.write('blender-double: simulated fatal error\n');
  process.exit(3);
}

// --- `--version`: the double's honest identity. -------------------------
if (args.includes('--version')) {
  process.stdout.write('Blender 4.2.11 LTS (epoch-double, not a real Blender)\n');
  process.exit(0);
}

// --- sidecar job mode: find the paths after Blender's `--` separator. ---
const separator = args.indexOf('--');
if (separator === -1 || args.length - separator !== 3) {
  fail('expected exactly two paths after the -- separator', 2);
}
const jobPath = args[separator + 1];
const reportPath = args[separator + 2];

let job;
try {
  job = JSON.parse(fs.readFileSync(jobPath, 'utf8'));
} catch (err) {
  fail(`the job spec is not readable JSON: ${err.message}`, 0);
}

const writeReport = (report) => {
  if (mode === 'no-report') {
    process.exit(0);
  }
  let text = JSON.stringify(report, null, 2);
  if (mode === 'garbage-report') {
    text = '{not valid json';
  }
  fs.writeFileSync(reportPath, text, 'utf8');
  process.exit(0);
};

const jobId = mode === 'wrong-job' ? `${job.jobId}-other` : job.jobId;

if (job.jobKind === 'probe') {
  writeReport({
    ok: true,
    jobId,
    jobKind: 'probe',
    blenderVersion: '4.2.11-epoch-double',
    entityCount: 0,
  });
}

if (job.jobKind !== 'render-offscene' && job.jobKind !== 'export-gltf') {
  writeReport({
    ok: false,
    jobId,
    errorCode: 'job-unsupported',
    message: `the double does not implement job kind "${job.jobKind}"`,
  });
}

const scene = job.scene ?? { entities: [], camera: {} };
const entities = scene.entities ?? [];
const output = job.output ?? { path: '/dev/null', width: 640, height: 480 };

if (job.jobKind === 'render-offscene') {
  // The deterministic "render": a labeled byte artifact (honestly NOT a
  // real PNG — the double renders no pixels; the boundary evidence is the
  // digest-addressed artifact + the typed report).
  const payload = {
    kind: 'epoch-blender-double-image',
    jobId: job.jobId,
    entityCount: entities.length,
    entityIds: entities.map((entity) => entity.entityId).sort(),
    width: output.width,
    height: output.height,
    worldDigest: scene.worldDigest ?? null,
  };
  const artifact = Buffer.concat([
    Buffer.from('EPOCHDOUBLE-IMAGE\n', 'utf8'),
    Buffer.from(JSON.stringify(payload), 'utf8'),
  ]);
  fs.writeFileSync(output.path, artifact);
  const info = { fileName: `${job.jobId}-image`, byteSize: artifact.length, digest: sha256(artifact) };
  if (mode === 'artifact-lies') {
    info.digest = 'a'.repeat(64);
  }
  writeReport({
    ok: true,
    jobId,
    jobKind: 'render-offscene',
    blenderVersion: '4.2.11-epoch-double',
    entityCount: entities.length,
    image: info,
  });
}

// export-gltf: build a REAL GLB (canonical triangle, entity-count-derived
// names) that must re-enter through the glTF bridge before anything binds.
const positions = Buffer.alloc(36);
const floats = [0, 0, 0, 1, 0, 0, 0, 1, 0];
for (let i = 0; i < floats.length; i += 1) {
  positions.writeFloatLE(floats[i], i * 4);
}
const gltfJson = {
  asset: { version: '2.0', generator: `epoch-blender-double/1 (${entities.length} entities)` },
  scene: 0,
  scenes: [{ name: 'Double export scene', nodes: [0] }],
  nodes: [{ name: 'Double export node', mesh: 0, translation: [0, 0, 0] }],
  meshes: [
    {
      name: `Double export mesh (${entities.length} entities)`,
      primitives: [{ attributes: { POSITION: 0 }, material: 0 }],
    },
  ],
  materials: [
    {
      name: 'Double export material',
      pbrMetallicRoughness: { baseColorFactor: [0.2, 0.5, 0.8, 1] },
    },
  ],
  accessors: [
    {
      bufferView: 0,
      componentType: 5126,
      count: 3,
      type: 'VEC3',
      min: [0, 0, 0],
      max: [1, 1, 0],
    },
  ],
  bufferViews: [{ buffer: 0, byteOffset: 0, byteLength: 36 }],
  buffers: [{ byteLength: 36 }],
};
const jsonBytes = Buffer.from(JSON.stringify(gltfJson), 'utf8');
const jsonPadding = Buffer.alloc((4 - (jsonBytes.length % 4)) % 4, 0x20);
const binPadding = Buffer.alloc((4 - (positions.length % 4)) % 4, 0);
const jsonChunkLength = jsonBytes.length + jsonPadding.length;
const binChunkLength = positions.length + binPadding.length;
const total = 12 + 8 + jsonChunkLength + 8 + binChunkLength;
const glb = Buffer.alloc(total);
glb.writeUInt32LE(0x46546c67, 0); // 'glTF'
glb.writeUInt32LE(2, 4);
glb.writeUInt32LE(total, 8);
glb.writeUInt32LE(jsonChunkLength, 12);
glb.writeUInt32LE(0x4e4f534a, 16); // 'JSON'
jsonBytes.copy(glb, 20);
jsonPadding.copy(glb, 20 + jsonBytes.length);
const binHeader = 20 + jsonChunkLength;
glb.writeUInt32LE(binChunkLength, binHeader);
glb.writeUInt32LE(0x004e4942, binHeader + 4); // 'BIN\0'
positions.copy(glb, binHeader + 8);
binPadding.copy(glb, binHeader + 8 + positions.length);

fs.writeFileSync(output.path, glb);
const glbInfo = { fileName: `${job.jobId}-glb`, byteSize: glb.length, digest: sha256(glb) };
if (mode === 'artifact-lies') {
  glbInfo.digest = 'b'.repeat(64);
}
writeReport({
  ok: true,
  jobId,
  jobKind: 'export-gltf',
  blenderVersion: '4.2.11-epoch-double',
  entityCount: entities.length,
  glb: glbInfo,
});
