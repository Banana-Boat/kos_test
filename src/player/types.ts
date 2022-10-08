import { KeyInput } from "puppeteer";

export interface PlayerInfoType {
  name: string;
  password: string;
}

export enum DirectionType {
  UP,
  RIGHT,
  DOWN,
  LEFT,
}

export const operMap = new Map<DirectionType, KeyInput>([
  [DirectionType.UP, "KeyW"],
  [DirectionType.LEFT, "KeyA"],
  [DirectionType.DOWN, "KeyS"],
  [DirectionType.RIGHT, "KeyD"],
]);
