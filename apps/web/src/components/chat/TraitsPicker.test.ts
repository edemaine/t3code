import { describe, expect, it } from "vite-plus/test";
import {
  ProviderDriverKind,
  type ProviderOptionDescriptor,
  type ServerProviderModel,
} from "@t3tools/contracts";
import {
  getReasoningLevelChange,
  buildTraitsTriggerDisplay,
  buildUnavailableModelOptionDescriptors,
} from "./TraitsPicker";

function selectDescriptor(
  id: string,
  options: ReadonlyArray<{ id: string; label: string; isDefault?: boolean }>,
  currentValue: string,
): Extract<ProviderOptionDescriptor, { type: "select" }> {
  return { id, label: id, type: "select", options: [...options], currentValue };
}

function fastModeDescriptor(
  currentValue: boolean,
): Extract<ProviderOptionDescriptor, { type: "boolean" }> {
  return { id: "fastMode", label: "Fast Mode", type: "boolean", currentValue };
}

function serviceTierDescriptor(
  currentValue: "default" | "priority" | "flex",
): Extract<ProviderOptionDescriptor, { type: "select" }> {
  return {
    id: "serviceTier",
    label: "Service Tier",
    type: "select",
    options: [
      { id: "default", label: "Standard", isDefault: true },
      { id: "priority", label: "Fast" },
      { id: "flex", label: "Flex" },
    ],
    currentValue,
  };
}

const EFFORT = selectDescriptor(
  "reasoningEffort",
  [
    { id: "high", label: "High" },
    { id: "max", label: "Max" },
  ],
  "high",
);
const CONTEXT_WINDOW = selectDescriptor(
  "contextWindow",
  [
    { id: "200k", label: "200k" },
    { id: "1m", label: "1M" },
  ],
  "1m",
);

const CODEX = ProviderDriverKind.make("codex");

function display(descriptors: ReadonlyArray<ProviderOptionDescriptor>) {
  return buildTraitsTriggerDisplay({
    provider: CODEX,
    descriptors,
    primarySelectDescriptorId: "reasoningEffort",
    ultrathinkPromptControlled: false,
  });
}

describe("buildTraitsTriggerDisplay", () => {
  it("omits fast mode from the label entirely when it is off", () => {
    expect(display([EFFORT, fastModeDescriptor(false), CONTEXT_WINDOW])).toEqual({
      label: "High · 1M",
      showFastModeIcon: false,
    });
  });

  it("shows the bolt instead of a text label when fast mode is on", () => {
    expect(display([EFFORT, fastModeDescriptor(true), CONTEXT_WINDOW])).toEqual({
      label: "High · 1M",
      showFastModeIcon: true,
    });
  });

  it("treats Codex standard and fast service tiers as fast mode states", () => {
    expect(display([EFFORT, serviceTierDescriptor("default")])).toEqual({
      label: "High",
      showFastModeIcon: false,
    });
    expect(display([EFFORT, serviceTierDescriptor("priority")])).toEqual({
      label: "High",
      showFastModeIcon: true,
    });
  });

  it("keeps other Codex service tiers in the label", () => {
    expect(display([EFFORT, serviceTierDescriptor("flex")])).toEqual({
      label: "High · Flex",
      showFastModeIcon: false,
    });
  });

  it("keeps the Codex service tier readable when it is the only trait", () => {
    expect(display([serviceTierDescriptor("default")])).toEqual({
      label: "Standard",
      showFastModeIcon: false,
    });
    expect(display([serviceTierDescriptor("priority")])).toEqual({
      label: "Fast",
      showFastModeIcon: false,
    });
  });

  it("keeps non-fastMode booleans as text labels", () => {
    const thinking: Extract<ProviderOptionDescriptor, { type: "boolean" }> = {
      id: "thinking",
      label: "Thinking",
      type: "boolean",
      currentValue: true,
    };
    expect(display([EFFORT, thinking])).toEqual({
      label: "High · Thinking On",
      showFastModeIcon: false,
    });
  });

  it("falls back to a text label when fast mode is the only trait", () => {
    expect(display([fastModeDescriptor(true)])).toEqual({
      label: "Fast",
      showFastModeIcon: false,
    });
    expect(display([fastModeDescriptor(false)])).toEqual({
      label: "Normal",
      showFastModeIcon: false,
    });
  });

  it("stays blank when descriptors resolve to no label and there is no fast mode", () => {
    // A select with neither a currentValue nor an isDefault option yields no
    // label. Without a fastMode descriptor present that must stay blank rather
    // than falling through to a bogus "Normal".
    const unresolved: Extract<ProviderOptionDescriptor, { type: "select" }> = {
      id: "effort",
      label: "effort",
      type: "select",
      options: [
        { id: "low", label: "Low" },
        { id: "high", label: "High" },
      ],
    };
    expect(display([unresolved])).toEqual({ label: "", showFastModeIcon: false });
  });

  it("still renders the prompt-controlled ultrathink label alongside the bolt", () => {
    expect(
      buildTraitsTriggerDisplay({
        provider: CODEX,
        descriptors: [EFFORT, fastModeDescriptor(true)],
        primarySelectDescriptorId: "reasoningEffort",
        ultrathinkPromptControlled: true,
      }),
    ).toEqual({ label: "Ultrathink", showFastModeIcon: true });
  });
});

describe("buildUnavailableModelOptionDescriptors", () => {
  it("shows only saved values without inventing alternatives", () => {
    expect(
      buildUnavailableModelOptionDescriptors([
        { id: "variant", value: "max" },
        { id: "agent", value: "build" },
        { id: "fastMode", value: true },
      ]),
    ).toEqual([
      {
        id: "variant",
        label: "Reasoning",
        type: "select",
        options: [{ id: "max", label: "max" }],
        currentValue: "max",
      },
      {
        id: "agent",
        label: "Agent",
        type: "select",
        options: [{ id: "build", label: "build" }],
        currentValue: "build",
      },
      {
        id: "fastMode",
        label: "Fast Mode",
        type: "boolean",
        currentValue: true,
      },
    ]);
  });
});

describe("reasoning level shortcuts", () => {
  const modelWith = (
    descriptors: ReadonlyArray<ProviderOptionDescriptor>,
  ): ReadonlyArray<ServerProviderModel> => [
    {
      slug: "test-model",
      name: "Test",
      isCustom: false,
      capabilities: { optionDescriptors: descriptors },
    },
  ];
  const options = [
    { id: "low", label: "Low" },
    { id: "high", label: "High", isDefault: true },
    { id: "ultrathink", label: "Ultrathink" },
  ];
  const input = {
    provider: CODEX,
    model: "test-model",
    models: modelWith([
      { ...selectDescriptor("effort", options, "high"), promptInjectedValues: ["ultrathink"] },
      fastModeDescriptor(false),
    ]),
    modelOptions: [{ id: "fastMode", value: true }],
    prompt: "Solve this",
    planModeEnabled: false,
    direction: -1 as const,
  };

  it("steps from the default, skips unsupported levels, and preserves other traits", () => {
    expect(
      getReasoningLevelChange({
        ...input,
        models: modelWith([
          { id: "effort", label: "Effort", type: "select", options },
          fastModeDescriptor(false),
        ]),
      }),
    ).toEqual({
      prompt: "Solve this",
      modelOptions: [
        { id: "effort", value: "low" },
        { id: "fastMode", value: true },
      ],
    });
  });

  it("stops at both ends", () => {
    expect(
      getReasoningLevelChange({ ...input, modelOptions: [{ id: "effort", value: "low" }] }),
    ).toBeNull();
    expect(
      getReasoningLevelChange({ ...input, prompt: "Ultrathink:\nSolve this", direction: 1 }),
    ).toBeNull();
  });

  it("enters and leaves prompt-controlled ultrathink", () => {
    const increased = getReasoningLevelChange({ ...input, direction: 1 });
    expect(increased).toEqual({ prompt: "Ultrathink:\nSolve this" });
    expect(getReasoningLevelChange({ ...input, prompt: increased!.prompt })).toEqual({
      prompt: "Solve this",
      modelOptions: [
        { id: "effort", value: "high" },
        { id: "fastMode", value: true },
      ],
    });
    expect(
      getReasoningLevelChange({ ...input, prompt: "Please ultrathink about this" }),
    ).toBeNull();
  });

  it("changes only the prompt when enabling ultrathink, and preserves slash commands", () => {
    expect(getReasoningLevelChange({ ...input, prompt: "", direction: 1 })).toEqual({
      prompt: "Ultrathink:\n",
    });
    expect(getReasoningLevelChange({ ...input, prompt: "/review", direction: 1 })).toEqual({
      prompt: "/review",
    });
  });

  it.each(["reasoningEffort", "effort", "variant"])("supports the %s descriptor", (id) => {
    expect(
      getReasoningLevelChange({
        ...input,
        models: modelWith([selectDescriptor(id, options, "high")]),
      })?.modelOptions,
    ).toEqual([{ id, value: "low" }]);
  });

  it.each(["agent", "contextWindow"])("does not step through %s options", (id) => {
    expect(
      getReasoningLevelChange({
        ...input,
        models: modelWith([selectDescriptor(id, options, "high")]),
      }),
    ).toBeNull();
  });

  it("does nothing when the model is unavailable", () => {
    expect(getReasoningLevelChange({ ...input, models: [] })).toBeNull();
  });
});
