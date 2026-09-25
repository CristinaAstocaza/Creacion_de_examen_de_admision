export type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface ToastPayload {
  type: ToastType;
  message: string;
  duration?: number;
}

export const showToast = (message: string, type: ToastType = 'info', duration = 3200) => {
  window.dispatchEvent(new CustomEvent<ToastPayload>('app-toast', {
    detail: { type, message, duration }
  }));
};

export const toastSuccess = (message: string) => showToast(message, 'success');
export const toastError = (message: string) => showToast(message, 'error', 4200);
export const toastWarning = (message: string) => showToast(message, 'warning', 3800);
export const toastInfo = (message: string) => showToast(message, 'info');
