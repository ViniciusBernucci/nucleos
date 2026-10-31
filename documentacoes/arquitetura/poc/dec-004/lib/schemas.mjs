// Carrega os JSON Schemas PROPOSTOS e compila validadores (ajv 2020).
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';

const dir = join(dirname(fileURLToPath(import.meta.url)), '../../../contratos-propostos');
const load = (f) => JSON.parse(readFileSync(join(dir, f), 'utf8'));

const ajv = new Ajv2020({ allErrors: false, strict: true });
addFormats(ajv);
const tokenSchema = load('runtime-token.schema.json');
const handshake = load('handshake.schema.json');
ajv.addSchema(tokenSchema);
ajv.addSchema(handshake);

const ref = (id, name) => ajv.getSchema(`${id}#/$defs/${name}`);
export const tokenId = tokenSchema.$id;
export const handshakeId = handshake.$id;
export const validate = {
  tokenHeader: ref(tokenId, 'header'),
  tokenClaims: ref(tokenId, 'claims'),
  enrollmentRequest: ref(handshakeId, 'enrollment_request'),
  enrollmentResponse: ref(handshakeId, 'enrollment_response'),
  tokenRequest: ref(handshakeId, 'token_request'),
  tokenResponse: ref(handshakeId, 'token_response'),
  jwks: ref(handshakeId, 'jwks'),
  revocationState: ref(handshakeId, 'revocation_state'),
};
for (const [k, v] of Object.entries(validate)) if (!v) throw new Error(`schema ausente: ${k}`);
