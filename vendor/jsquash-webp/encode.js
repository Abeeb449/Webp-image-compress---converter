/**
 * Copyright 2020 Google Inc. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *     http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 * Vendored from @jsquash/webp@1.5.0 (encode.js). The only change is that the
 * `wasm-feature-detect` dependency has been inlined as a small local SIMD
 * check, so this file can be self-hosted with no external dependencies.
 */
import { defaultOptions } from './meta.js';
import { initEmscriptenModule } from './utils.js';

// Inlined SIMD detection (equivalent to wasm-feature-detect's `simd()`):
// validates a tiny module that uses a v128 (SIMD) instruction.
async function simd() {
    try {
        return WebAssembly.validate(new Uint8Array([
            0, 97, 115, 109, 1, 0, 0, 0, 1, 5, 1, 96, 0, 1, 123, 3, 2, 1,
            0, 10, 10, 1, 8, 0, 65, 0, 253, 15, 253, 98, 11,
        ]));
    } catch (e) {
        return false;
    }
}

let emscriptenModule;
export async function init(module, moduleOptionOverrides) {
    let actualModule = module;
    let actualOptions = moduleOptionOverrides;
    // If only one argument is provided and it's not a WebAssembly.Module
    if (arguments.length === 1 && !(module instanceof WebAssembly.Module)) {
        actualModule = undefined;
        actualOptions = module;
    }
    // This build ships only the SIMD codec. If the browser lacks WebAssembly
    // SIMD support, throw so the caller can fall back to another encoder.
    if (!(await simd())) {
        throw new Error('WebAssembly SIMD is required for the libwebp encoder');
    }
    const webpEncoder = await import('./codec/enc/webp_enc_simd.js');
    emscriptenModule = initEmscriptenModule(webpEncoder.default, actualModule, actualOptions);
    return emscriptenModule;
}
export default async function encode(data, options = {}) {
    if (!emscriptenModule)
        emscriptenModule = init();
    const _options = { ...defaultOptions, ...options };
    const module = await emscriptenModule;
    const result = module.encode(data.data, data.width, data.height, _options);
    if (!result)
        throw new Error('Encoding error.');
    return result.buffer;
}
