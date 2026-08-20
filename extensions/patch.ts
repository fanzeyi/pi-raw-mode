import type { AssistantMessage } from "@earendil-works/pi-ai";
import * as codingAgent from "@earendil-works/pi-coding-agent";

import { renderRawAssistant } from "./raw-renderer.ts";

const PATCH_SYMBOL = Symbol.for("pi-raw-mode.assistant-renderer-patch.v1");

type Render = (width: number) => string[];
type UpdateContent = (message: AssistantMessage, isStreaming?: boolean) => void;

interface AssistantComponent {
	render: Render;
	updateContent: UpdateContent;
	lastMessage?: AssistantMessage;
	[key: symbol]: unknown;
}

interface AssistantComponentClass {
	prototype: AssistantComponent;
}

interface PatchState {
	enabled: boolean;
	users: number;
	messages: WeakMap<object, AssistantMessage>;
	originalRender: Render;
	originalUpdateContent: UpdateContent;
	patchedRender: Render;
	patchedUpdateContent: UpdateContent;
}

export interface RawModePatchController {
	readonly compatible: boolean;
	readonly incompatibilityReason?: string;
	isEnabled(): boolean;
	setEnabled(enabled: boolean): void;
	dispose(): void;
}

function unavailable(reason: string): RawModePatchController {
	return {
		compatible: false,
		incompatibilityReason: reason,
		isEnabled: () => false,
		setEnabled: () => {},
		dispose: () => {},
	};
}

export function installRawModePatch(initiallyEnabled: boolean): RawModePatchController {
	const piVersion = (codingAgent as { VERSION?: unknown }).VERSION;
	if (typeof piVersion !== "string" || !/^0\.84\./.test(piVersion)) {
		return unavailable(
			`Pi ${String(piVersion ?? "unknown")} is not supported; expected Pi 0.84.x.`,
		);
	}

	const Component = codingAgent.AssistantMessageComponent as unknown as
		| AssistantComponentClass
		| undefined;
	const prototype = Component?.prototype;
	if (!prototype) {
		return unavailable("Pi no longer exports AssistantMessageComponent.");
	}
	if (
		typeof prototype.render !== "function" ||
		typeof prototype.updateContent !== "function"
	) {
		return unavailable("Pi's assistant message component API has changed.");
	}

	let state = prototype[PATCH_SYMBOL] as PatchState | undefined;
	if (!state) {
		const messages = new WeakMap<object, AssistantMessage>();
		const originalRender = prototype.render;
		const originalUpdateContent = prototype.updateContent;

		const patchedUpdateContent: UpdateContent = function (
			this: AssistantComponent,
			message,
			isStreaming,
		): void {
			messages.set(this, message);
			originalUpdateContent.call(this, message, isStreaming);
		};

		const patchedRender: Render = function (
			this: AssistantComponent,
			width,
		): string[] {
			if (!state?.enabled) return originalRender.call(this, width);
			const message = messages.get(this) ?? this.lastMessage;
			return message
				? renderRawAssistant(message, width)
				: originalRender.call(this, width);
		};

		state = {
			enabled: initiallyEnabled,
			users: 0,
			messages,
			originalRender,
			originalUpdateContent,
			patchedRender,
			patchedUpdateContent,
		};
		Object.defineProperty(prototype, PATCH_SYMBOL, {
			configurable: true,
			value: state,
		});
		prototype.updateContent = patchedUpdateContent;
		prototype.render = patchedRender;
	}

	if (state.users === 0) {
		if (prototype.render === state.originalRender) {
			prototype.render = state.patchedRender;
		}
		if (prototype.updateContent === state.originalUpdateContent) {
			prototype.updateContent = state.patchedUpdateContent;
		}
	}
	state.users += 1;
	state.enabled = initiallyEnabled;
	let disposed = false;

	return {
		compatible: true,
		isEnabled: () => state.enabled,
		setEnabled: (enabled) => {
			state.enabled = enabled;
		},
		dispose: () => {
			if (disposed) return;
			disposed = true;
			state.users = Math.max(0, state.users - 1);
			if (state.users > 0) return;

			state.enabled = false;
			if (prototype.render === state.patchedRender) {
				prototype.render = state.originalRender;
			}
			if (prototype.updateContent === state.patchedUpdateContent) {
				prototype.updateContent = state.originalUpdateContent;
			}
			if (
				prototype.render === state.originalRender &&
				prototype.updateContent === state.originalUpdateContent
			) {
				delete prototype[PATCH_SYMBOL];
			}
		},
	};
}
