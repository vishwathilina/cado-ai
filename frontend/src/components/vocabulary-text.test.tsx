import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { VocabularyText } from "./vocabulary-text";

describe("VocabularyText", () => {
  it("does not highlight words until enabled", () => {
    render(<VocabularyText text="Photosynthesis is remarkable" enabled={false} />);
    expect(screen.queryByRole("button", { name: /Photosynthesis/ })).toBeNull();
  });

  it("loads a definition for a complex English word", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          word: "photosynthesis",
          definition: "How plants make food from light.",
          pronunciation: "foh-toh-SIN-thuh-sis",
          example: "Leaves use photosynthesis.",
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
    render(<VocabularyText text="Photosynthesis is remarkable" enabled />);
    fireEvent.click(screen.getByRole("button", { name: /Photosynthesis/ }));
    await waitFor(() => {
      expect(screen.getByText("How plants make food from light.")).toBeInTheDocument();
    });
  });
});
