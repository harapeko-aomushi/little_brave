import Phaser from 'phaser';
import { SCREEN_HEIGHT, SCREEN_WIDTH } from '../data/constants';

export type ViewportMetrics = {
  height: number;
  width: number;
  zoom: number;
};

export function getWideGameWidth(windowWidth = window.innerWidth, windowHeight = window.innerHeight): number {
  if (windowHeight <= 0) {
    return SCREEN_WIDTH;
  }

  return Math.max(SCREEN_WIDTH, Math.round((windowWidth / windowHeight) * SCREEN_HEIGHT));
}

export function applyWideViewport(scene: Phaser.Scene): ViewportMetrics {
  const width = Math.max(SCREEN_WIDTH, scene.scale.width);

  scene.cameras.main.setViewport(0, 0, width, SCREEN_HEIGHT);
  scene.cameras.main.setZoom(1);
  scene.cameras.main.roundPixels = true;

  return {
    height: SCREEN_HEIGHT,
    width,
    zoom: 1
  };
}
