<script lang="ts">
	import { PromptInputController, setPromptInputProvider } from "./attachments-context.svelte.js";

	interface Props {
		initialInput?: string;
		accept?: string;
		multiple?: boolean;
		children?: import("svelte").Snippet;
	}

	let { initialInput = "", accept, multiple = true, children }: Props = $props();

	const controller = new PromptInputController();

	setPromptInputProvider(controller);

	$effect.pre(() => {
		controller.textInput.value = initialInput;
	});

	$effect.pre(() => {
		controller.attachments.accept = accept;
		controller.attachments.multiple = multiple;
	});
</script>

{#if children}
	{@render children()}
{/if}
