// Run every chapter scenario sequentially (each launches its own clean EDH).
const chapters = [
  "./ch1-create-folder.mjs",
  "./ch2-section-editor.mjs",
  "./ch3-workflows.mjs",
  "./ch4-unit-operations.mjs",
  "./ch5-samples.mjs",
  "./ch6-tables.mjs",
  "./ch7-extras.mjs",
];

for (const ch of chapters) {
  console.log(`\n===== running ${ch} =====`);
  await import(ch);
}
console.log("\n===== all chapters complete =====");
