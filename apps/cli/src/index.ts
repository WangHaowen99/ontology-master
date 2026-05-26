#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { createPipeline, detectSourceType } from '@om/ingestion';
import { ModelingPipeline } from '@om/modeler';
import { createOntology, validateOntology, OntologyOperations } from '@om/ontology';
import type { OntologyModel, IngestedSchema } from '@om/ontology';
import { writeFileSync } from 'node:fs';
import { resolve, basename } from 'node:path';

const program = new Command();

program
  .name('om')
  .description('本体建模大师 CLI — AI-driven OWL ontology modeling from any data source')
  .version('0.1.0');

// ─── import command ───

program
  .command('import <source>')
  .description('Import data source and generate ontology model')
  .option('-e, --export <format>', 'Export format: turtle, rdfxml, owlxml, jsonld', 'turtle')
  .option('-o, --output <path>', 'Output file path')
  .option('-p, --provider <name>', 'LLM provider: deepseek, openai, anthropic', 'deepseek')
  .option('-m, --model <name>', 'LLM model name')
  .option('--api-key <key>', 'API key (or set via env: DEEPSEEK_API_KEY, OPENAI_API_KEY, ANTHROPIC_API_KEY)')
  .option('--language <lang>', 'Language: zh, en', 'zh')
  .action(async (source: string, options) => {
    const spinner = ora();

    try {
      // Step 1: Ingest data
      spinner.start(`Reading data source: ${source}`);
      const pipeline = createPipeline();
      const sourcePath = resolve(source);
      const type = detectSourceType(sourcePath);
      const name = basename(sourcePath);

      const schema = await pipeline.ingest(
        { type, path: sourcePath, name },
        (phase, percent, message) => {
          spinner.text = `${message} (${percent}%)`;
        }
      );

      spinner.succeed(`Ingested ${name} (${schema.type})`);

      if (schema.tables) {
        console.log(chalk.gray(`  Tables: ${schema.tables.length}`));
        for (const table of schema.tables) {
          console.log(chalk.gray(`    - ${table.name}: ${table.columns.length} columns, ${table.rowCount ?? '?'} rows`));
        }
      }
      if (schema.entities) {
        console.log(chalk.gray(`  Entities: ${schema.entities.length}`));
      }
      if (schema.textSegments) {
        console.log(chalk.gray(`  Text segments: ${schema.textSegments.length}`));
      }

      // Step 2: Create ontology model
      const prefix = name.replace(/\.\w+$/, '').replace(/[^a-zA-Z0-9]/g, '_');
      const model = createOntology(`http://example.org/${prefix}`, prefix, { title: prefix });

      // Step 3: Run AI modeling pipeline
      const apiKey = options.apiKey
        || process.env.DEEPSEEK_API_KEY
        || process.env.OPENAI_API_KEY
        || process.env.ANTHROPIC_API_KEY
        || '';

      if (!apiKey) {
        console.log(chalk.yellow('  Warning: No API key provided. Set DEEPSEEK_API_KEY, OPENAI_API_KEY, or ANTHROPIC_API_KEY env variable.'));
        console.log(chalk.yellow('  Skipping AI modeling. Use --api-key or set env variable.'));
      } else {
        spinner.start('Running AI modeling pipeline...');

        const modeler = new ModelingPipeline({
          provider: options.provider,
          providerConfig: { apiKey },
          model: options.model,
          language: options.language,
        });

        for await (const event of modeler.runFull(model, [schema])) {
          if (event.type === 'text_delta') {
            spinner.text = `[${event.phase ?? ''}] ${event.content?.slice(0, 50) ?? ''}`;
          }
        }

        spinner.succeed('AI modeling complete');
      }

      // Step 4: Validate
      const validation = validateOntology(model);
      if (validation.valid) {
        console.log(chalk.green('  ✓ Ontology validation passed'));
      } else {
        for (const err of validation.errors) {
          console.log(chalk.red(`  ✗ ${err.message}`));
        }
      }
      for (const warn of validation.warnings) {
        console.log(chalk.yellow(`  ⚠ ${warn.message}`));
      }

      // Step 5: Export
      const ops = new OntologyOperations(model);
      const stats = ops.stats();
      console.log(chalk.cyan(`\n  Ontology: ${model.metadata.title}`));
      console.log(chalk.cyan(`  Classes: ${stats.classes}, Object Properties: ${stats.objectProperties}, Data Properties: ${stats.dataProperties}, Individuals: ${stats.individuals}`));

      const ext = options.export === 'turtle' ? 'ttl' : options.export === 'jsonld' ? 'jsonld' : 'owl';
      const outputPath = options.output ?? `${prefix}.${ext}`;

      // Use Python backend for export if available, otherwise use simple TTL generator
      if (apiKey) {
        try {
          const response = await fetch('http://localhost:8765/api/export/ontology', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ model, format: options.export }),
          });
          const content = await response.text();
          writeFileSync(outputPath, content, 'utf-8');
        } catch {
          console.log(chalk.yellow('  Python backend not available, using built-in TTL generator'));
          const content = generateSimpleTTL(model);
          writeFileSync(outputPath, content, 'utf-8');
        }
      } else {
        const content = generateSimpleTTL(model);
        writeFileSync(outputPath, content, 'utf-8');
      }

      console.log(chalk.green(`\n  ✓ Exported to: ${resolve(outputPath)}`));
    } catch (error) {
      spinner.fail(`Error: ${error instanceof Error ? error.message : String(error)}`);
      process.exit(1);
    }
  });

// ─── validate command ───

program
  .command('validate <file>')
  .description('Validate an existing ontology model JSON file')
  .action(async (file: string) => {
    try {
      const { readFileSync } = await import('node:fs');
      const content = readFileSync(resolve(file), 'utf-8');
      const model = JSON.parse(content) as OntologyModel;
      const result = validateOntology(model);

      if (result.valid) {
        console.log(chalk.green('✓ Ontology is valid'));
      } else {
        console.log(chalk.red('✗ Validation errors:'));
        for (const err of result.errors) {
          console.log(chalk.red(`  - ${err.message}`));
        }
      }
      for (const warn of result.warnings) {
        console.log(chalk.yellow(`  ⚠ ${warn.message}`));
      }
    } catch (error) {
      console.error(chalk.red(`Error: ${error instanceof Error ? error.message : String(error)}`));
      process.exit(1);
    }
  });

// ─── Simple TTL generator (fallback when Python backend unavailable) ───

function generateSimpleTTL(model: OntologyModel): string {
  const lines: string[] = [
    `@prefix ${model.prefix}: <${model.iri}#> .`,
    `@prefix owl: <http://www.w3.org/2002/07/owl#> .`,
    `@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .`,
    `@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .`,
    `@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .`,
    '',
    `<${model.iri}> a owl:Ontology ;`,
    `    rdfs:label "${model.metadata.title}" .`,
    '',
  ];

  for (const cls of model.classes) {
    lines.push(`${model.prefix}:${cls.iri.local} a owl:Class ;`);
    if (cls.label) lines.push(`    rdfs:label "${cls.label}" ;`);
    if (cls.description) lines.push(`    rdfs:comment "${cls.description}" ;`);
    for (const sup of cls.superClasses) {
      lines.push(`    rdfs:subClassOf ${model.prefix}:${sup.local} ;`);
    }
    lines[lines.length - 1] = lines[lines.length - 1].replace(/ ;$/, ' .');
    lines.push('');
  }

  for (const prop of model.objectProperties) {
    lines.push(`${model.prefix}:${prop.iri.local} a owl:ObjectProperty ;`);
    if (prop.label) lines.push(`    rdfs:label "${prop.label}" ;`);
    if (prop.description) lines.push(`    rdfs:comment "${prop.description}" ;`);
    for (const dom of prop.domain) {
      if (dom.kind === 'iri') lines.push(`    rdfs:domain ${model.prefix}:${dom.iri.local} ;`);
    }
    for (const rng of prop.range) {
      if (rng.kind === 'iri') lines.push(`    rdfs:range ${model.prefix}:${rng.iri.local} ;`);
    }
    lines[lines.length - 1] = lines[lines.length - 1].replace(/ ;$/, ' .');
    lines.push('');
  }

  for (const prop of model.dataProperties) {
    lines.push(`${model.prefix}:${prop.iri.local} a owl:DatatypeProperty ;`);
    if (prop.label) lines.push(`    rdfs:label "${prop.label}" ;`);
    for (const dom of prop.domain) {
      if (dom.kind === 'iri') lines.push(`    rdfs:domain ${model.prefix}:${dom.iri.local} ;`);
    }
    for (const rng of prop.range) {
      lines.push(`    rdfs:range ${rng} ;`);
    }
    lines[lines.length - 1] = lines[lines.length - 1].replace(/ ;$/, ' .');
    lines.push('');
  }

  for (const ind of model.individuals) {
    lines.push(`${model.prefix}:${ind.iri.local} a`);
    for (const clsIRI of ind.classIRIs) {
      lines.push(`    ${model.prefix}:${clsIRI.local} ,`);
    }
    lines[lines.length - 1] = lines[lines.length - 1].replace(/ ,$/, ' ;');
    if (ind.label) lines.push(`    rdfs:label "${ind.label}" .`);
    else lines[lines.length - 1] = lines[lines.length - 1].replace(/ ;$/, ' .');
    lines.push('');
  }

  return lines.join('\n');
}

program.parse();
