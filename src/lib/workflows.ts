/**
 * Workflow Templates for Biofoundry Operations
 * Based on standardized DBTL (Design-Build-Test-Learn) cycle
 * 
 * This file is used by the VS Code extension commands.
 * The webview has its own copy at webview/src/data/workflows.ts
 */

export interface Workflow {
  id: string;
  name: string;
  description: string;
  category: 'Design' | 'Build' | 'Test' | 'Learn';
}

export const WORKFLOWS: Workflow[] = [
  // Design Phase
  {
    id: 'WD010',
    name: 'General Design of Experiment',
    description: 'General-purpose approach for experimental design using DOE methodology',
    category: 'Design',
  },
  {
    id: 'WD020',
    name: 'Adaptive Laboratory Evolution Design',
    description: 'Top-down design using random mutations and artificial evolution',
    category: 'Design',
  },
  {
    id: 'WD030',
    name: 'Growth Media Design',
    description: 'Design growth media for strain culture with data-driven approach',
    category: 'Design',
  },
  {
    id: 'WD040',
    name: 'Parallel Cell Culture Design',
    description: 'Design conditions for large-scale culturing of proteins or enzymes',
    category: 'Design',
  },
  {
    id: 'WD050',
    name: 'DNA Oligomer Pool Design',
    description: 'Design oligomer pool for assembling target DNA sequences',
    category: 'Design',
  },
  {
    id: 'WD070',
    name: 'Vector Design',
    description: 'Design plasmid vectors, BACs, YACs, HACs construction',
    category: 'Design',
  },
  {
    id: 'WD090',
    name: 'Genome Editing Design',
    description: 'CRISPR-based genome editing design with gRNA optimization',
    category: 'Design',
  },
  {
    id: 'WD100',
    name: 'Protein Library Design',
    description: 'Design libraries to optimize protein activity and specificity',
    category: 'Design',
  },

  // Build Phase
  {
    id: 'WB005',
    name: 'Nucleotide Quantification',
    description: 'Quantify nucleic acids using UV absorbance and fluorometric assays',
    category: 'Build',
  },
  {
    id: 'WB010',
    name: 'DNA Oligomer Assembly',
    description: 'Assemble DNA oligomers into kilobase-length sequences',
    category: 'Build',
  },
  {
    id: 'WB030',
    name: 'DNA Assembly',
    description: 'Assemble double-stranded DNA fragments into larger constructs',
    category: 'Build',
  },
  {
    id: 'WB040',
    name: 'DNA Purification',
    description: 'Refine crude DNA extracts to high purity',
    category: 'Build',
  },
  {
    id: 'WB050',
    name: 'RNA Extraction',
    description: 'Isolate RNA from biological samples for downstream analysis',
    category: 'Build',
  },
  {
    id: 'WB090',
    name: 'Protein Purification',
    description: 'Purify target proteins or enzymes to high purity',
    category: 'Build',
  },
  {
    id: 'WB120',
    name: 'Biology-mediated DNA Transfers',
    description: 'Transform designed vectors into cells via transformation/conjugation',
    category: 'Build',
  },
  {
    id: 'WB150',
    name: 'PCR-based Target Amplification',
    description: 'Amplify target gene sequence using PCR from complex templates',
    category: 'Build',
  },

  // Test Phase
  {
    id: 'WT010',
    name: 'Nucleotide Sequencing',
    description: 'Run NGS instruments to generate raw sequencing data',
    category: 'Test',
  },
  {
    id: 'WT020',
    name: 'Protein Expression Measurement',
    description: 'Quantify expression levels of target proteins',
    category: 'Test',
  },
  {
    id: 'WT030',
    name: 'Protein/Enzyme Activity Measurement',
    description: 'Measure activity of purified proteins or enzymes',
    category: 'Test',
  },
  {
    id: 'WT060',
    name: 'Metabolite Measurement',
    description: 'Quantify metabolites using GC-MS, LC-MS, spectroscopy',
    category: 'Test',
  },
  {
    id: 'WT100',
    name: 'Micro-scale Parallel Cell Culture',
    description: 'Culture cells in 96 deep well plates for high-throughput screening',
    category: 'Test',
  },
  {
    id: 'WT120',
    name: 'Parallel Cell Fermentation',
    description: 'Fermentation in 15-250ml volumes with real-time monitoring',
    category: 'Test',
  },
  {
    id: 'WT140',
    name: 'Lab-scale Fermentation',
    description: 'Fermentations less than 10L with parameter monitoring',
    category: 'Test',
  },

  // Learn Phase
  {
    id: 'WL010',
    name: 'Sequence Variant Analysis',
    description: 'Verify sequence of template DNA including genes and plasmids',
    category: 'Learn',
  },
  {
    id: 'WL020',
    name: 'Genome Resequencing Analysis',
    description: 'Analyze SNPs and genome variations with reference genomes',
    category: 'Learn',
  },
  {
    id: 'WL050',
    name: 'Transcriptome Analysis',
    description: 'Analyze transcriptomes for differential gene expression',
    category: 'Learn',
  },
  {
    id: 'WL060',
    name: 'Metabolic Pathway Optimization',
    description: 'Develop ML/AI models for metabolic pathway optimization',
    category: 'Learn',
  },
  {
    id: 'WL080',
    name: 'Protein/Enzyme Optimization',
    description: 'Develop models to optimize protein characteristics',
    category: 'Learn',
  },
  {
    id: 'WL090',
    name: 'Fermentation Optimization',
    description: 'Explore optimal conditions for compound production',
    category: 'Learn',
  },
];
