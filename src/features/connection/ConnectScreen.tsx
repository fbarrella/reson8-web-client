import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { connectToServer } from "@/services/connectionService";
import { useConnectionStore } from "@/stores/connectionStore";
import { getOrCreateInstanceId } from "@/lib/instanceId";
import { normalizeServerUrl } from "@/lib/serverUrl";
import {
  loadRememberedConnection,
  saveRememberedConnection,
  clearRememberedConnection,
} from "@/lib/rememberMe";

const connectSchema = z.object({
  serverUrl: z.string().min(1, "Server URL is required"),
  nickname: z
    .string()
    .min(2, "Nickname must be at least 2 characters")
    .max(32, "Nickname must be 32 characters or fewer"),
  password: z.string().optional(),
  rememberMe: z.boolean(),
});

type ConnectFormValues = z.infer<typeof connectSchema>;

export function ConnectScreen() {
  const navigate = useNavigate();
  const status = useConnectionStore((s) => s.status);
  const error = useConnectionStore((s) => s.error);
  const [showPassword, setShowPassword] = useState(false);

  const remembered = loadRememberedConnection();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ConnectFormValues>({
    resolver: zodResolver(connectSchema),
    defaultValues: {
      serverUrl: remembered?.serverUrl ?? "",
      nickname: remembered?.nickname ?? "",
      password: remembered?.password ?? "",
      rememberMe: remembered !== null,
    },
  });

  const onSubmit = async (values: ConnectFormValues) => {
    const instanceId = getOrCreateInstanceId();
    const serverUrl = normalizeServerUrl(values.serverUrl);

    const result = await connectToServer({
      serverUrl,
      nickname: values.nickname,
      password: values.password || undefined,
      instanceId,
    });

    if (result.success) {
      if (values.rememberMe) {
        saveRememberedConnection({
          serverUrl: values.serverUrl,
          nickname: values.nickname,
          password: values.password ?? "",
        });
      } else {
        clearRememberedConnection();
      }
      navigate("/app", { replace: true });
    }
  };

  const isConnecting = status === "connecting";

  return (
    <main className="flex min-h-dvh items-center justify-center p-4">
      <div className="w-full max-w-sm rounded-lg border border-border bg-card p-6 shadow-lg">
        <h1 className="mb-1 text-center text-2xl font-semibold text-card-foreground">Reson8</h1>
        <p className="mb-6 text-center text-sm text-muted-foreground">
          Connect to a self-hosted Reson8 server.
        </p>

        <form onSubmit={(e) => void handleSubmit(onSubmit)(e)} noValidate className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="serverUrl">Server URL</Label>
            <Input
              id="serverUrl"
              placeholder="voice.example.com:9800"
              autoComplete="url"
              aria-invalid={!!errors.serverUrl}
              {...register("serverUrl")}
            />
            {errors.serverUrl && (
              <p className="text-sm text-destructive-text">{errors.serverUrl.message}</p>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="nickname">Nickname</Label>
            <Input
              id="nickname"
              placeholder="Your display name"
              autoComplete="username"
              aria-invalid={!!errors.nickname}
              {...register("nickname")}
            />
            {errors.nickname && (
              <p className="text-sm text-destructive-text">{errors.nickname.message}</p>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="password">Password (if required)</Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                className="pr-11"
                {...register("password")}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? "Hide password" : "Show password"}
                className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-muted-foreground hover:text-foreground"
              >
                {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
          </div>

          <label className="flex min-h-11 items-center gap-2 text-sm text-foreground">
            <input type="checkbox" className="size-4" {...register("rememberMe")} />
            Remember me
          </label>

          {error && (
            <p role="alert" className="rounded-md bg-destructive/15 p-3 text-sm text-destructive-text">
              {error}
            </p>
          )}

          <Button type="submit" size="lg" disabled={isConnecting} className="mt-2">
            {isConnecting && <Loader2 className="size-4 animate-spin" />}
            {isConnecting ? "Connecting…" : "Connect"}
          </Button>
        </form>
      </div>
    </main>
  );
}
