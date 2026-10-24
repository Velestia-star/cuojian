import { useStore } from 'zustand';
import { appStore } from './deps';
import type { AppState } from './store';

/** 组件只读 store，不直接碰 Repository（禁止事项里明确写了）。 */
export function useAppStore<T>(selector: (state: AppState) => T): T {
  return useStore(appStore, selector);
}
