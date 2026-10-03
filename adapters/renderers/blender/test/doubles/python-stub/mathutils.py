# W068 (ACR-011) — the MINIMAL honest `mathutils` STUB for the CI
# sidecar-Python guard (test/sidecar-python.test.ts).
#
# This is NOT Blender's mathutils: it implements only the slice the pinned
# sidecar script uses (Vector subtraction + to_track_quat().to_euler() for
# the deterministic camera framing). Values are inert — the guard proves the
# sidecar's PROTOCOL, never Blender's mathematics.
#
# Injected ONLY via PYTHONPATH by the guard battery (see bpy.py beside it).


class _Quat:
    def to_euler(self):
        return (0.0, 0.0, 0.0)


class Vector:
    def __init__(self, seq):
        self._values = list(seq)

    def __sub__(self, other):
        return Vector(a - b for a, b in zip(self._values, other._values))

    def to_track_quat(self, axis, up):
        return _Quat()
