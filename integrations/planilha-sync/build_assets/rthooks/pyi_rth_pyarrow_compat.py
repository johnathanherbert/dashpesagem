"""
Runtime hook: garante compatibilidade do pyarrow com stubs do PyInstaller.
Igual ao usado no aging_flask.
"""
import sys
import types

try:
    import pyarrow as _pa
    if not hasattr(_pa, '__version__') or not isinstance(getattr(_pa, '__version__', None), str):
        _pa.__version__ = '0.0.0'
except Exception:
    _dummy = types.ModuleType('pyarrow')
    _dummy.__version__ = '0.0.0'
    sys.modules['pyarrow'] = _dummy
