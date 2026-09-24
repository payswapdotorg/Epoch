// @epoch/constraint-language — core hand-written types.
//
// Recursive types (AuthoredExpr, CompiledExpr, JsonValue) are hand-written and
// used to annotate the recursive zod schemas (src/schema/*); every other public
// type is inferred from its zod schema. The published contract surface in
// `contracts/constraints/v1` mirrors these types; equality is enforced by the
// contract-sync tests.

/** Literal value kinds expressible in the authored language. */
export type LiteralType = 'number' | 'string' | 'boolean';

/** Static value types tracked by the compiler and annotated on compiled nodes. */
export type ValueType = 'number' | 'string' | 'boolean' | 'record' | 'list';

/** Authored expression AST (human-editable, serializable, pre-compilation). */
export type AuthoredExpr =
  | { node: 'lit'; type: LiteralType; value: number | string | boolean }
  | { node: 'input'; name: string }
  | { node: 'lt'; left: AuthoredExpr; right: AuthoredExpr }
  | { node: 'le'; left: AuthoredExpr; right: AuthoredExpr }
  | { node: 'gt'; left: AuthoredExpr; right: AuthoredExpr }
  | { node: 'ge'; left: AuthoredExpr; right: AuthoredExpr }
  | { node: 'eq'; left: AuthoredExpr; right: AuthoredExpr }
  | { node: 'ne'; left: AuthoredExpr; right: AuthoredExpr }
  | { node: 'and'; operands: AuthoredExpr[] }
  | { node: 'or'; operands: AuthoredExpr[] }
  | { node: 'not'; operand: AuthoredExpr }
  | { node: 'implies'; antecedent: AuthoredExpr; consequent: AuthoredExpr }
  | { node: 'add'; operands: AuthoredExpr[] }
  | { node: 'mul'; operands: AuthoredExpr[] }
  | { node: 'sub'; left: AuthoredExpr; right: AuthoredExpr }
  | { node: 'div'; left: AuthoredExpr; right: AuthoredExpr }
  | { node: 'has'; record: AuthoredExpr; key: string }
  | { node: 'get'; record: AuthoredExpr; key: string; fallback: AuthoredExpr }
  | { node: 'count'; list: AuthoredExpr }
  | { node: 'contains'; list: AuthoredExpr; value: string };

/** Compiled expression AST: authored nodes annotated with static result types. */
export type CompiledExpr =
  | { node: 'lit'; resultType: ValueType; type: LiteralType; value: number | string | boolean }
  | { node: 'input'; resultType: ValueType; name: string }
  | { node: 'lt'; resultType: ValueType; left: CompiledExpr; right: CompiledExpr }
  | { node: 'le'; resultType: ValueType; left: CompiledExpr; right: CompiledExpr }
  | { node: 'gt'; resultType: ValueType; left: CompiledExpr; right: CompiledExpr }
  | { node: 'ge'; resultType: ValueType; left: CompiledExpr; right: CompiledExpr }
  | { node: 'eq'; resultType: ValueType; left: CompiledExpr; right: CompiledExpr }
  | { node: 'ne'; resultType: ValueType; left: CompiledExpr; right: CompiledExpr }
  | { node: 'and'; resultType: ValueType; operands: CompiledExpr[] }
  | { node: 'or'; resultType: ValueType; operands: CompiledExpr[] }
  | { node: 'not'; resultType: ValueType; operand: CompiledExpr }
  | { node: 'implies'; resultType: ValueType; antecedent: CompiledExpr; consequent: CompiledExpr }
  | { node: 'add'; resultType: ValueType; operands: CompiledExpr[] }
  | { node: 'mul'; resultType: ValueType; operands: CompiledExpr[] }
  | { node: 'sub'; resultType: ValueType; left: CompiledExpr; right: CompiledExpr }
  | { node: 'div'; resultType: ValueType; left: CompiledExpr; right: CompiledExpr }
  | { node: 'has'; resultType: ValueType; record: CompiledExpr; key: string }
  | { node: 'get'; resultType: ValueType; record: CompiledExpr; key: string; fallback: CompiledExpr }
  | { node: 'count'; resultType: ValueType; list: CompiledExpr }
  | { node: 'contains'; resultType: ValueType; list: CompiledExpr; value: string };

/** JSON-compatible value (the evaluation-context envelope payload domain). */
export type JsonValue =
  | null
  | boolean
  | number
  | string
  | JsonValue[]
  | { [key: string]: JsonValue };
