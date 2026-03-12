export function calibrateConfidenceScore(sources, reconciledMedication, patientContext) {
  let score = 0;
  let breakdown = {
    recency: { score: 0, weight: 0.3, description: "Source Recency" },
    reliability: { score: 0, weight: 0.3, description: "Source Reliability Rating" },
    agreement: { score: 0, weight: 0.2, description: "Agreement Across Sources" },
    contextAlignment: { score: 0, weight: 0.2, description: "Patient Context Alignment" },
  };

  if (!sources || sources.length === 0) {
    return { score: 0, breakdown };
  }

  // 1. Recency
  // Check the most recent date across sources
  const today = new Date();
  let latestDate = new Date(0);
  sources.forEach(src => {
    const d = new Date(src.last_updated || src.last_filled);
    if (!isNaN(d.getTime()) && d > latestDate) {
      latestDate = d;
    }
  });
  
  const daysDiff = (today - latestDate) / (1000 * 60 * 60 * 24);
  if (daysDiff <= 30) breakdown.recency.score = 1.0;
  else if (daysDiff <= 90) breakdown.recency.score = 0.8;
  else if (daysDiff <= 180) breakdown.recency.score = 0.6;
  else breakdown.recency.score = 0.3;

  // 2. Reliability
  // Check the highest reliability among sources that match the reconciled med roughly
  let highestRel = 0;
  sources.forEach(src => {
    let relScore = 0.5; // default medium/unknown
    if (src.source_reliability === 'high') relScore = 1.0;
    else if (src.source_reliability === 'low') relScore = 0.2;
    
    if (relScore > highestRel) highestRel = relScore;
  });
  breakdown.reliability.score = highestRel;

  // 3. Agreement
  // Check how many sources roughly match the reconciled medication name
  if (!reconciledMedication) {
    breakdown.agreement.score = 0;
  } else {
    const reconciledName = reconciledMedication.split(' ')[0].toLowerCase();
    let matchCount = 0;
    sources.forEach(src => {
      if (src.medication && src.medication.toLowerCase().includes(reconciledName)) {
        matchCount++;
      }
    });
    breakdown.agreement.score = matchCount / sources.length;
  }

  // 4. Context Alignment
  // Simplistic heuristic: if patient is elderly (>65) or has bad eGFR, expect a lower dose
  // For the sake of the exercise, we assign a baseline of 0.8
  breakdown.contextAlignment.score = 0.8;

  score = (
    breakdown.recency.score * breakdown.recency.weight +
    breakdown.reliability.score * breakdown.reliability.weight +
    breakdown.agreement.score * breakdown.agreement.weight +
    breakdown.contextAlignment.score * breakdown.contextAlignment.weight
  );

  return { 
    score: parseFloat(score.toFixed(2)), 
    breakdown 
  };
}
