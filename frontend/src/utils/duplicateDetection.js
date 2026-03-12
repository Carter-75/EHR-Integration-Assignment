export function detectDuplicates(sources) {
  if (!sources || sources.length < 2) return [];

  const duplicates = [];
  const handled = new Set();

  for (let i = 0; i < sources.length; i++) {
    if (handled.has(i)) continue;

    const sourceA = sources[i];
    const nameA = (sourceA.medication || '').toLowerCase().trim();
    if (!nameA) continue;

    const currentGroup = [i];

    for (let j = i + 1; j < sources.length; j++) {
      if (handled.has(j)) continue;

      const sourceB = sources[j];
      const nameB = (sourceB.medication || '').toLowerCase().trim();
      if (!nameB) continue;

      // Extract raw names to compare (assuming format like "Metformin 500mg daily")
      const drugNameA = nameA.split(' ')[0];
      const drugNameB = nameB.split(' ')[0];
      
      const isSameDrug = drugNameA === drugNameB;
      
      // We consider it a duplicate if the drug names match roughly.
      if (isSameDrug) {
        currentGroup.push(j);
        handled.add(j);
      }
    }

    if (currentGroup.length > 1) {
      duplicates.push(currentGroup.map(index => sources[index]));
    }
  }

  return duplicates;
}
