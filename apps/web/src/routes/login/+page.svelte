<script lang="ts">
  import { goto } from "$app/navigation";
  import { Button } from "$lib/components/ui/button";
  import * as Card from "$lib/components/ui/card";
  import { Input } from "$lib/components/ui/input";

  let password = $state("");
  let isSubmitting = $state(false);
  let errorMessage = $state("");
  const INTERNAL_EMAIL = "owner@goodchat.internal";

  const handleSubmit = async (event: SubmitEvent) => {
    event.preventDefault();

    if (isSubmitting) {
      return;
    }

    isSubmitting = true;
    errorMessage = "";

    try {
      const response = await fetch("/api/auth/sign-in/email", {
        method: "POST",
        credentials: "include",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          email: INTERNAL_EMAIL,
          password,
        }),
      });

      if (response.ok) {
        await goto("/");
        return;
      }

      errorMessage = "Invalid password";
    } catch {
      errorMessage = "Invalid password";
    } finally {
      isSubmitting = false;
    }
  };
</script>

<div class="mx-auto flex min-h-dvh w-full max-w-md items-center px-4">
  <Card.Root class="w-full">
    <Card.Header>
      <Card.Title>Login</Card.Title>
      <Card.Description>
        Enter your dashboard password to continue.
      </Card.Description>
    </Card.Header>
    <Card.Content>
      <form class="space-y-4" onsubmit={handleSubmit}>
        <div class="space-y-2">
          <label for="password" class="text-sm font-medium">Password</label>
          <Input
            id="password"
            type="password"
            bind:value={password}
            autocomplete="current-password"
            required
          />
        </div>

        {#if errorMessage}
          <p class="text-sm text-destructive">{errorMessage}</p>
        {/if}

        <Button type="submit" class="w-full" disabled={isSubmitting}>
          {isSubmitting ? "Signing in..." : "Sign in"}
        </Button>
      </form>
    </Card.Content>
  </Card.Root>
</div>
