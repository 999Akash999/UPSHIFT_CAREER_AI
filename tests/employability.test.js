const calculateEmployabilityScore = require("../utils/calculateScore");

describe("Employability Scoring Formula Suite", () => {
  it("should compute exact composite score based on defined weights", () => {
    // Weights: Assessments(35%) + Projects(25%) + Roadmap(25%) + Interviews(15%)
    // Expected: 80 * 0.35 (28) + 90 * 0.25 (22.5) + 60 * 0.25 (15) + 70 * 0.15 (10.5) = 76
    const result = calculateEmployabilityScore({
      assessments: 80,
      projects: 90,
      roadmap: 60,
      interviews: 70,
    });

    expect(result.overallScore).toBe(76);
    expect(result.grade).toBe("Gold");
    expect(result.breakdown.technical).toBe(80);
    expect(result.breakdown.problemSolving).toBe(85); // Math.round((80 + 90) / 2)
  });

  it("should clamp scores above 100 or below 0 safely", () => {
    const overflown = calculateEmployabilityScore({
      assessments: 120,
      projects: 150,
      roadmap: 110,
      interviews: 200,
    });
    expect(overflown.overallScore).toBe(100);
    expect(overflown.grade).toBe("Diamond");

    const negative = calculateEmployabilityScore({
      assessments: -50,
      projects: -20,
      roadmap: 0,
      interviews: 0,
    });
    expect(negative.overallScore).toBe(0);
    expect(negative.grade).toBe("Bronze");
  });
});