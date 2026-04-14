/**
 * VoxelVolumetricEffect — React bridge for the volumetric voxel system.
 * Exposes imperative API via ref for spawning/injecting volumes.
 * Manages VolumetricCompositor lifecycle within R3F scene.
 */
import { useRef, useImperativeHandle, forwardRef, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { VolumetricCompositor, CompositorConfig } from '@/render_ultra/volumetric/VolumetricCompositor';
import { VoxelGridConfig } from '@/render_ultra/volumetric/VoxelGrid';
import { SimulationConfig } from '@/render_ultra/volumetric/VolumeSimulation';
import { RaymarchConfig } from '@/render_ultra/volumetric/RaymarchRenderer';
import { InjectionSource } from '@/render_ultra/volumetric/DensityInjection';

export interface VoxelVolumetricAPI {
  spawn: (
    gridConfig?: Partial<VoxelGridConfig>,
    maxAge?: number,
    fadeIn?: number,
    fadeOut?: number,
    simConfig?: Partial<SimulationConfig>,
    raymarchConfig?: Partial<RaymarchConfig>,
  ) => string;
  inject: (id: string, sources: InjectionSource[]) => void;
  activeCount: () => number;
}

interface Props {
  enabled?: boolean;
  compositorConfig?: Partial<CompositorConfig>;
  gpuDevice?: GPUDevice | null;
}

const VoxelVolumetricEffect = forwardRef<VoxelVolumetricAPI, Props>(
  ({ enabled = true, compositorConfig = {}, gpuDevice }, ref) => {
    const { scene } = useThree();
    const compositorRef = useRef<VolumetricCompositor | null>(null);

    // Init compositor
    useEffect(() => {
      if (!enabled) return;

      const compositor = new VolumetricCompositor(scene, compositorConfig, gpuDevice ?? undefined);
      compositorRef.current = compositor;

      return () => {
        compositor.dispose();
        compositorRef.current = null;
      };
    }, [scene, enabled, gpuDevice]);

    // Imperative API
    useImperativeHandle(ref, () => ({
      spawn: (gridConfig, maxAge, fadeIn, fadeOut, simConfig, raymarchConfig) => {
        if (!compositorRef.current) return '';
        return compositorRef.current.spawn(gridConfig, maxAge, fadeIn, fadeOut, simConfig, raymarchConfig);
      },
      inject: (id, sources) => {
        compositorRef.current?.inject(id, sources);
      },
      activeCount: () => compositorRef.current?.activeCount ?? 0,
    }), []);

    // Per-frame update
    useFrame(({ clock, camera }) => {
      if (!enabled || !compositorRef.current) return;
      compositorRef.current.update(1 / 60, clock.elapsedTime, camera.position);
    });

    return null;
  }
);

VoxelVolumetricEffect.displayName = 'VoxelVolumetricEffect';
export default VoxelVolumetricEffect;
