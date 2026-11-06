import { BadRequestException, type PipeTransform } from "@nestjs/common";
export class CorpoFinanceiroPipe implements PipeTransform<unknown, Record<string, unknown>> {
  transform(valor: unknown): Record<string, unknown> {
    if (typeof valor !== "object" || valor === null || Array.isArray(valor))
      throw new BadRequestException("objeto esperado");
    return valor as Record<string, unknown>;
  }
}
