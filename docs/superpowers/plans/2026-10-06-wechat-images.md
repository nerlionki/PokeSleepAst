# WeChat image repair plan

Goal: Restore all packaged images without a server, keeping the approved shared core and five native tabs.

Architecture: Build PNG image payloads into resource subpackages. A copied native CommonJS bridge uses WeChat require.async; the shared image resolver writes individual images to USER_DATA_PATH and shares the resulting paths with UI and OCR. Include both core assets and public item/sprite resources. Cache names contain content hashes.

- [x] Cover package sharing, native file paths, corrupted caches, retries, missing resources and stale component requests with regression tests.
- [x] Generate bounded resource payloads, wire a native external bridge, replace the invalid loadSubpackage path, and include missing resources.
- [x] Verify every manifest entry against compiled payload bytes, PNG format, content hash and package limits; typecheck and rebuild the local WeChat ZIP.
- [x] Commit task changes, preserve existing user modifications, synchronize 1.0.3 and main. Keep the existing public release assets intact.

Follow-up: page chunks resolve native externals relative to pages/<name>. Generate forwarding modules on every webpack compilation, including watch rebuilds. Verify all five emitted importing chunks using native relative require semantics, including the final async resource path. Regression tests, production build and typecheck passed.

Runtime verification: connected to the user's WeChat developer tools after they enabled the service port. Reproduced the missing asset-pack0/images.js module. Replace computed async paths with generated literal require.async dependencies so developer tools retain each resource module. Verified all 11 packages / 1532 entries at runtime, all nine image categories decode through getImageInfo, and all 249 Pokedex images render. The miniapp page background is solid #081018; screenshots before/after scrolling have matching RGB (8,16,24). Production build, typecheck, and 14 image/form regressions passed. Local screenshots are in app/release, outside GitHub Release assets.
