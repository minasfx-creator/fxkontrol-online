/**
 * FXK GPU — Pass orchestration.
 * Encodes a single frame's command buffer using the 7-stage pipeline.
 * Zero-GC: no allocations in the hot path.
 */

import {
  runComputePass,
  runFireRenderPass,
  runSmokeRenderPass,
  runSortPass,
  runSmokeComputePass,
} from '../webgpuPasses';
import { runLightScatterPass } from '../webgpuLightScatter';
import type { FXKPipelineSet } from './pipelines';
import type { FXKBindGroupSet } from './bindGroups';
import type { FXKBufferSet } from './buffers';

export interface FXKFrameConfig {
  enableSort: boolean;
  enableSmokeSim: boolean;
  enableLightScatter: boolean;
}

/**
 * Encode one complete frame into the given command encoder.
 *
 * Pipeline order:
 *   1. Compute Physics
 *   2. Compute Smoke (curl noise)
 *   3. Bitonic Sort
 *   4. Fire Render (additive, clear)
 *   5. Smoke Render (alpha, load)
 *   6. Light Scatter (fullscreen, additive)
 *   7. Present (implicit via queue.submit)
 */
export function encodeFrame(
  encoder: GPUCommandEncoder,
  textureView: GPUTextureView,
  pipelines: FXKPipelineSet,
  bindGroups: FXKBindGroupSet,
  buffers: FXKBufferSet,
  count: number,
  isBufferA: boolean,
  config: FXKFrameConfig,
  sortData: Uint32Array | null,
  sortUniform: GPUBuffer | null,
  device: GPUDevice,
): void {
  // 1. Compute Physics
  const computeBind = isBufferA ? bindGroups.computeA : bindGroups.computeB;
  runComputePass(encoder, pipelines.compute, computeBind, count);

  // 2. Compute Smoke (curl noise advection)
  if (pipelines.smokeCompute && config.enableSmokeSim) {
    const smokeBind = isBufferA ? bindGroups.smokeComputeA! : bindGroups.smokeComputeB!;
    runSmokeComputePass(encoder, pipelines.smokeCompute, smokeBind, count);
  }

  // 3. Bitonic Sort
  if (pipelines.sort && config.enableSort && sortData && sortUniform) {
    const sortBind = isBufferA ? bindGroups.sortA! : bindGroups.sortB!;
    for (let blockSize = 2; blockSize <= count; blockSize *= 2) {
      for (let sub = blockSize; sub >= 2; sub /= 2) {
        sortData[0] = blockSize;
        sortData[1] = sub;
        sortData[2] = count;
        sortData[3] = 0;
        device.queue.writeBuffer(sortUniform, 0, sortData);
        runSortPass(encoder, pipelines.sort, sortBind, count);
      }
    }
  }

  // 4. Fire Render (clear framebuffer, ACES tonemapped)
  runFireRenderPass(encoder, textureView, pipelines.fire, bindGroups.fire, buffers.pingPong.current, count);

  // 5. Smoke Render (load, Beer-Lambert absorption)
  runSmokeRenderPass(encoder, textureView, pipelines.smoke, bindGroups.smoke, buffers.pingPong.current, count);

  // 6. Light Scatter (fullscreen additive warming)
  if (pipelines.light && bindGroups.lightScatter && config.enableLightScatter) {
    runLightScatterPass(encoder, textureView, pipelines.light, bindGroups.lightScatter);
  }
}
