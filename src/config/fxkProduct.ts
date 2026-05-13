export type FxkProduct = 'editor' | 'kontrol';

export const FXK_EDITOR_HOME = '/studio';
export const FXK_KONTROL_HOME = '/command';

const PRODUCT_ENV = String(import.meta.env.VITE_FXK_PRODUCT ?? '').toLowerCase();

export function getFxkProduct(): FxkProduct {
  return PRODUCT_ENV === 'editor' ? 'editor' : 'kontrol';
}

export function getProductHomeRoute(product: FxkProduct = getFxkProduct()): string {
  return product === 'editor' ? FXK_EDITOR_HOME : FXK_KONTROL_HOME;
}

export function getProductBrand(product: FxkProduct = getFxkProduct()): string {
  return product === 'editor' ? 'FXK EDITOR' : 'FXK KONTROL';
}

export function getProductModuleLabel(product: FxkProduct = getFxkProduct()): string {
  return product === 'editor' ? 'Edicao e JOI' : 'Operacao real';
}

export function isEditorProduct(product: FxkProduct = getFxkProduct()): boolean {
  return product === 'editor';
}

export function isKontrolProduct(product: FxkProduct = getFxkProduct()): boolean {
  return product === 'kontrol';
}
