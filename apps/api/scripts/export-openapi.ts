/** Gera docs/openapi.json a partir dos controllers (sem subir o servidor HTTP). */
import '../src/timezone';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { AppModule } from '../src/app.module';

async function main() {
  const app = await NestFactory.create(AppModule, { logger: false });
  const config = new DocumentBuilder().setTitle('PersonalPro API').setVersion('1.0.0').addBearerAuth().build();
  const doc = SwaggerModule.createDocument(app, config);
  writeFileSync(join(__dirname, '../../../docs/openapi.json'), JSON.stringify(doc, null, 2));
  await app.close();
  console.log(`docs/openapi.json: ${Object.keys(doc.paths).length} rotas`);
}
void main();
