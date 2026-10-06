# WeChat image repair plan

Goal: Restore all packaged images without a server, keeping the approved shared core and five native tabs.

Architecture: Build PNG image payloads into resource subpackages. A copied native CommonJS bridge uses WeChat require.async; the shared image resolver writes individual images to USER_DATA_PATH and shares the resulting paths with UI and OCR. Include both core assets and public item/sprite resources. Cache names contain content hashes.

- [x] Cover package sharing, native file paths, corrupted caches, retries, missing resources and stale component requests with regression tests.
- [x] Generate bounded resource payloads, wire a native external bridge, replace the invalid loadSubpackage path, and include missing resources.
- [x] Verify every manifest entry against compiled payload bytes, PNG format, content hash and package limits; typecheck and rebuild the local WeChat ZIP.
- [x] Commit task changes, preserve existing user modifications, synchronize 1.0.3 and main. Keep the existing public release assets intact.
