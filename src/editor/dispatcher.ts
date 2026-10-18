import { registry } from "../input/registry";
export type CommandHandler = (payload?: any) => void;
// Dispatch is stateless: the existing Editor owns draft/history/operation state.
export class CommandDispatcher {
  constructor(
    private handlers: Record<string, CommandHandler>,
    private feedback: (message: string) => void,
  ) {}
  dispatch(command: string, payload?: any) {
    const meta = registry.get(command),
      handler = this.handlers[command];
    if (!meta || !meta.available || !handler) {
      this.feedback(`${meta?.label ?? command}: 현재 미구현 명령입니다.`);
      return false;
    }
    handler(payload);
    return true;
  }
}
