export function reconcileCounts(input: {
  resources: { id: string; state: string }[];
  people: { id: string; resourceInstanceId: string | null; status: string }[];
}) {
  const resourceIds = new Set(input.resources.map((r) => r.id));
  const peopleByResource = new Map<string, number>();
  for (const p of input.people) {
    if (p.resourceInstanceId && resourceIds.has(p.resourceInstanceId)) {
      peopleByResource.set(p.resourceInstanceId, (peopleByResource.get(p.resourceInstanceId) ?? 0) + 1);
    }
  }
  return {
    resourceCount: input.resources.length,
    personnelCount: input.people.length,
    activeResources: input.resources.filter((r) => r.state === "Active").length,
    activePersonnel: input.people.filter((p) => p.status === "Active").length,
    peopleByResource
  };
}
