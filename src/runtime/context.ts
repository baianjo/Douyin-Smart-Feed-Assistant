type ControllerLike = {
  isRunning: boolean;
  start(): Promise<void> | void;
  stop(): Promise<void> | void;
};

type UILike = {
  log(message: string, type?: string, level?: string): void;
};

let controllerRef: ControllerLike | null = null;
let uiRef: UILike | null = null;

export const setController = (controller: ControllerLike) => {
  controllerRef = controller;
};

export const getController = () => {
  if (!controllerRef) {
    throw new Error('Controller context has not been initialized yet.');
  }
  return controllerRef;
};

export const setUI = (ui: UILike) => {
  uiRef = ui;
};

export const getUI = () => {
  if (!uiRef) {
    throw new Error('UI context has not been initialized yet.');
  }
  return uiRef;
};
