import stellar_sdk
print("Top level attributes:", dir(stellar_sdk))
try:
    from stellar_sdk import SorobanServer
    print("Found SorobanServer at top level")
except ImportError:
    print("SorobanServer NOT at top level")
