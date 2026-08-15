import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ConnectScreen } from "@/features/connection/ConnectScreen";
import { useConnectionStore } from "@/stores/connectionStore";

vi.mock("@/services/connectionService", () => ({
  connectToServer: vi.fn().mockResolvedValue({ success: true }),
}));

import { connectToServer } from "@/services/connectionService";

describe("ConnectScreen", () => {
  beforeEach(() => {
    localStorage.clear();
    useConnectionStore.getState().reset();
    vi.mocked(connectToServer).mockClear();
  });

  it("renders the connect form", () => {
    render(
      <MemoryRouter>
        <ConnectScreen />
      </MemoryRouter>,
    );

    expect(screen.getByRole("heading", { name: /reson8/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/server url/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/nickname/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /connect/i })).toBeInTheDocument();
  });

  it("shows a validation error when nickname is too short", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <ConnectScreen />
      </MemoryRouter>,
    );

    await user.type(screen.getByLabelText(/server url/i), "voice.example.com");
    await user.type(screen.getByLabelText(/nickname/i), "a");
    await user.click(screen.getByRole("button", { name: /connect/i }));

    expect(await screen.findByText(/at least 2 characters/i)).toBeInTheDocument();
    expect(connectToServer).not.toHaveBeenCalled();
  });

  it("submits normalized values on valid input", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <ConnectScreen />
      </MemoryRouter>,
    );

    await user.type(screen.getByLabelText(/server url/i), "voice.example.com:9800");
    await user.type(screen.getByLabelText(/nickname/i), "Felipe");
    await user.click(screen.getByRole("button", { name: /connect/i }));

    await waitFor(() => {
      expect(connectToServer).toHaveBeenCalledWith(
        expect.objectContaining({
          serverUrl: "wss://voice.example.com:9800",
          nickname: "Felipe",
        }),
      );
    });
  });
});
