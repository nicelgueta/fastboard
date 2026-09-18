import React from 'react';
import {
    Modal,
    ModalBody,
    ModalCloseButton,
    ModalContent,
    ModalFooter,
    ModalHeader,
    ModalOverlay,
    HStack,
    VStack,
    Box,
    Text,
    Code,
    IconButton,
} from '@chakra-ui/react';
import { MdClose, MdAdd } from 'react-icons/md';
import useAppColors, { RADIUS } from '../../hooks/useAppColors';
import { stopPropagation } from '../../components/common';
import FBButton from '../../components/primitive/Button';
import FBInput from '../../components/primitive/Input';
import FBNumberInput from '../../components/primitive/NumberInput';
import FBSelect from '../../components/primitive/Select';
import FBMultiSelect from '../../components/primitive/MultiSelect';
import type { SelectOption } from '../../interfaces';
import type {
    ComparisonOp,
    Condition,
    Expression,
    FieldDef,
    FieldType,
    Group,
} from '../../data/types';
import { emptyCondition, emptyGroup, toHumanString, toSql, validate } from '../../data/expression';

/**
 * Modal that edits an Expression tree against an arbitrary FieldDef[].
 *
 * Deliberately generic: no duckdb import anywhere in this file, so it works
 * unchanged against any future DataSource implementation (see PLAN.md
 * Phase 6b - "Keep this component generic over FieldDef[] and Expression").
 */

const OPS_BY_TYPE: Record<FieldType, ComparisonOp[]> = {
    string: [
        'eq', 'neq', 'contains', 'notContains', 'startsWith', 'notStartsWith',
        'endsWith', 'notEndsWith', 'like', 'notLike', 'isNull', 'isNotNull',
    ],
    number: ['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'between', 'notBetween', 'isNull', 'isNotNull'],
    integer: ['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'between', 'notBetween', 'isNull', 'isNotNull'],
    boolean: ['eq', 'neq', 'isNull', 'isNotNull'],
    date: ['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'between', 'notBetween', 'isNull', 'isNotNull'],
    timestamp: ['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'between', 'notBetween', 'isNull', 'isNotNull'],
    categorical: ['eq', 'neq', 'in', 'notIn', 'isNull', 'isNotNull'],
};

const OP_LABELS: Record<ComparisonOp, string> = {
    eq: '=', neq: '≠', gt: '>', gte: '≥', lt: '<', lte: '≤',
    contains: 'contains', notContains: 'does not contain',
    startsWith: 'starts with', notStartsWith: 'does not start with',
    endsWith: 'ends with', notEndsWith: 'does not end with',
    like: 'like (SQL pattern)', notLike: 'not like (SQL pattern)',
    in: 'in', notIn: 'not in',
    between: 'between', notBetween: 'not between',
    isNull: 'is empty', isNotNull: 'is not empty',
};

const NO_VALUE_OPS = new Set<ComparisonOp>(['isNull', 'isNotNull']);
const RANGE_OPS = new Set<ComparisonOp>(['between', 'notBetween']);
const LIST_OPS = new Set<ComparisonOp>(['in', 'notIn']);

function fieldOptions(fields: FieldDef[]): SelectOption[] {
    return fields.map((f) => ({ label: f.label ?? f.name, value: f.name }));
}

function opOptions(type: FieldType): SelectOption[] {
    return OPS_BY_TYPE[type].map((op) => ({ label: OP_LABELS[op], value: op }));
}

/* --------------------------------------------------------------------- */
/* Immutable tree edits                                                   */
/* --------------------------------------------------------------------- */

function mapNode(node: Expression, id: string, fn: (n: Expression) => Expression): Expression {
    if (node.id === id) return fn(node);
    if (node.kind === 'group') {
        return { ...node, children: node.children.map((c) => mapNode(c, id, fn)) };
    }
    return node;
}

function removeChild(node: Group, id: string): Group {
    return {
        ...node,
        children: node.children
            .filter((c) => c.id !== id)
            .map((c) => (c.kind === 'group' ? removeChild(c, id) : c)),
    };
}

function addChild(node: Expression, parentId: string, child: Expression): Expression {
    if (node.kind === 'group') {
        if (node.id === parentId) return { ...node, children: [...node.children, child] };
        return { ...node, children: node.children.map((c) => addChild(c, parentId, child)) };
    }
    return node;
}

/* --------------------------------------------------------------------- */
/* Value editors                                                          */
/* --------------------------------------------------------------------- */

interface ValueEditorProps {
    field: FieldDef;
    op: ComparisonOp;
    value: Condition['value'];
    onChange: (value: Condition['value']) => void;
    getCategories?: (field: string) => Promise<SelectOption[]>;
    typ: 'info' | 'success' | 'warning' | 'fail';
}

const useCategoryOptions = (field: FieldDef, getCategories?: (field: string) => Promise<SelectOption[]>) => {
    const [options, setOptions] = React.useState<SelectOption[]>(
        field.categories ? field.categories.map((c) => ({ label: c.label, value: c.value })) : []
    );
    React.useEffect(() => {
        let cancelled = false;
        if (field.categories) {
            setOptions(field.categories.map((c) => ({ label: c.label, value: c.value })));
            return;
        }
        if (getCategories) {
            getCategories(field.name)
                .then((opts) => { if (!cancelled) setOptions(opts); })
                .catch(() => { if (!cancelled) setOptions([]); });
        }
        return () => { cancelled = true; };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [field.name]);
    return options;
};

const ValueEditor: React.FC<ValueEditorProps> = ({ field, op, value, onChange, getCategories, typ }) => {
    const categoryOptions = useCategoryOptions(field, getCategories);

    if (NO_VALUE_OPS.has(op)) {
        return null;
    }

    if (RANGE_OPS.has(op)) {
        const arr = Array.isArray(value) ? value : [undefined, undefined];
        const [lo, hi] = arr;
        const setLo = (v: any) => onChange([v, hi] as any);
        const setHi = (v: any) => onChange([lo, v] as any);
        if (field.type === 'number' || field.type === 'integer') {
            return (
                <HStack w="100%">
                    <FBNumberInput typ={typ} value={lo as number | undefined} setValue={setLo} />
                    <Text>and</Text>
                    <FBNumberInput typ={typ} value={hi as number | undefined} setValue={setHi} />
                </HStack>
            );
        }
        const inputType = field.type === 'date' ? 'date' : field.type === 'timestamp' ? 'datetime-local' : 'text';
        return (
            <HStack w="100%">
                <FBInput typ={typ} type={inputType} value={(lo as string) ?? ''} setValue={setLo} />
                <Text>and</Text>
                <FBInput typ={typ} type={inputType} value={(hi as string) ?? ''} setValue={setHi} />
            </HStack>
        );
    }

    if (LIST_OPS.has(op)) {
        const arr = (Array.isArray(value) ? value : []).map((v) => String(v));
        return (
            <FBMultiSelect
                typ={typ}
                options={categoryOptions}
                value={arr}
                setValue={(selected: string[]) => {
                    // Map back to the category's original value type (number vs string).
                    const mapped = selected.map((s) => {
                        const cat = categoryOptions.find((o) => String(o.value) === s);
                        return cat ? cat.value : s;
                    });
                    onChange(mapped as any);
                }}
                boxLabel="Values"
            />
        );
    }

    if (field.type === 'boolean') {
        return (
            <FBSelect
                typ={typ}
                options={[{ label: 'True', value: 'true' }, { label: 'False', value: 'false' }]}
                value={value === undefined ? '' : String(value)}
                setValue={(v: string) => onChange(v === 'true')}
            />
        );
    }

    if (field.type === 'categorical') {
        return (
            <FBSelect
                typ={typ}
                options={categoryOptions}
                value={value === undefined || value === null ? '' : String(value)}
                setValue={(v: string) => {
                    const cat = categoryOptions.find((o) => String(o.value) === v);
                    onChange(cat ? cat.value : v);
                }}
            />
        );
    }

    if (field.type === 'number' || field.type === 'integer') {
        return (
            <FBNumberInput
                typ={typ}
                value={value as number | undefined}
                setValue={(v: number) => onChange(v)}
            />
        );
    }

    if (field.type === 'date' || field.type === 'timestamp') {
        return (
            <FBInput
                typ={typ}
                type={field.type === 'date' ? 'date' : 'datetime-local'}
                value={(value as string) ?? ''}
                setValue={(v: string) => onChange(v)}
            />
        );
    }

    return (
        <FBInput
            typ={typ}
            value={(value as string) ?? ''}
            setValue={(v: string) => onChange(v)}
        />
    );
};

/* --------------------------------------------------------------------- */
/* Condition row                                                          */
/* --------------------------------------------------------------------- */

interface ConditionRowProps {
    condition: Condition;
    fields: FieldDef[];
    onChange: (next: Condition) => void;
    onRemove: () => void;
    getCategories?: (field: string) => Promise<SelectOption[]>;
    isStatic?: boolean;
}

const ConditionRow: React.FC<ConditionRowProps> = ({ condition, fields, onChange, onRemove, getCategories, isStatic }) => {
    const [colors] = useAppColors();
    const fieldDef = fields.find((f) => f.name === condition.field);

    const setField = (name: string) => {
        const def = fields.find((f) => f.name === name);
        if (!def) {
            onChange({ ...condition, field: name, value: undefined });
            return;
        }
        const validOps = OPS_BY_TYPE[def.type];
        const nextOp = validOps.includes(condition.op) ? condition.op : validOps[0];
        onChange({ ...condition, field: name, op: nextOp, value: undefined });
    };

    const setOp = (op: ComparisonOp) => {
        onChange({ ...condition, op, value: undefined });
    };

    const setValue = (value: Condition['value']) => {
        onChange({ ...condition, value });
    };

    return (
        <HStack w="100%" align="flex-start" spacing={2} paddingY={1}>
            <Box minW="180px">
                <FBSelect
                    typ="info"
                    options={[{ label: 'Select field…', value: '' }, ...fieldOptions(fields)]}
                    value={condition.field}
                    setValue={setField}
                    isDisabled={isStatic}
                />
            </Box>
            {fieldDef ? (
                <Box minW="160px">
                    <FBSelect
                        typ="info"
                        options={opOptions(fieldDef.type)}
                        value={condition.op}
                        setValue={(v: string) => setOp(v as ComparisonOp)}
                        isDisabled={isStatic}
                    />
                </Box>
            ) : null}
            {fieldDef && !isStatic ? (
                <Box flex={1} minW="160px">
                    <ValueEditor
                        field={fieldDef}
                        op={condition.op}
                        value={condition.value}
                        onChange={setValue}
                        getCategories={getCategories}
                        typ="info"
                    />
                </Box>
            ) : <Box flex={1} />}
            <IconButton
                aria-label="Remove condition"
                icon={<MdClose size={12} />}
                size="sm"
                borderRadius={RADIUS.sm}
                bg="transparent"
                color={colors.fail}
                _hover={{ bg: colors.failQuarter }}
                onClick={onRemove}
                isDisabled={isStatic}
            />
        </HStack>
    );
};

/* --------------------------------------------------------------------- */
/* Group editor                                                           */
/* --------------------------------------------------------------------- */

interface GroupEditorProps {
    group: Group;
    fields: FieldDef[];
    depth: number;
    onChangeNode: (id: string, fn: (n: Expression) => Expression) => void;
    onRemoveNode: (id: string) => void;
    onAddChild: (parentId: string, child: Expression) => void;
    getCategories?: (field: string) => Promise<SelectOption[]>;
    isRoot?: boolean;
    isStatic?: boolean;
}

const GroupEditor: React.FC<GroupEditorProps> = ({
    group, fields, depth, onChangeNode, onRemoveNode, onAddChild, getCategories, isRoot, isStatic,
}) => {
    const [colors] = useAppColors();

    return (
        <Box
            borderLeftWidth={depth > 0 ? 2 : 0}
            borderLeftColor={colors.foreQuarter}
            paddingLeft={depth > 0 ? 3 : 0}
            marginLeft={depth > 0 ? 1 : 0}
        >
            <HStack spacing={2} paddingY={1} wrap="wrap">
                <FBSelect
                    typ="info"
                    w="90px"
                    options={[{ label: 'AND', value: 'and' }, { label: 'OR', value: 'or' }]}
                    value={group.combinator}
                    setValue={(v: string) => onChangeNode(group.id, (n) => ({ ...(n as Group), combinator: v as 'and' | 'or' }))}
                    isDisabled={isStatic}
                />
                <FBButton
                    typ={group.negated ? 'fail' : 'info'}
                    variant={group.negated ? undefined : 'outline'}
                    size="sm"
                    onClick={() => onChangeNode(group.id, (n) => ({ ...(n as Group), negated: !(n as Group).negated }))}
                    isDisabled={isStatic}
                >
                    NOT
                </FBButton>
                <FBButton
                    typ="success"
                    variant="outline"
                    size="sm"
                    leftIcon={<MdAdd size={12} />}
                    onClick={() => onAddChild(group.id, emptyCondition())}
                    isDisabled={isStatic}
                >
                    Condition
                </FBButton>
                <FBButton
                    typ="info"
                    variant="outline"
                    size="sm"
                    leftIcon={<MdAdd size={12} />}
                    onClick={() => onAddChild(group.id, emptyGroup())}
                    isDisabled={isStatic}
                >
                    Group
                </FBButton>
                {!isRoot ? (
                    <IconButton
                        aria-label="Remove group"
                        icon={<MdClose size={12} />}
                        size="sm"
                        borderRadius={RADIUS.sm}
                        bg="transparent"
                        color={colors.fail}
                        _hover={{ bg: colors.failQuarter }}
                        onClick={() => onRemoveNode(group.id)}
                        isDisabled={isStatic}
                    />
                ) : null}
            </HStack>
            <VStack align="stretch" spacing={0} w="100%">
                {group.children.length === 0 ? (
                    <Text color={colors.foreHalf} fontSize="sm" paddingLeft={2}>
                        Empty group - matches everything. Add a condition or a nested group.
                    </Text>
                ) : null}
                {group.children.map((child) =>
                    child.kind === 'condition' ? (
                        <ConditionRow
                            key={child.id}
                            condition={child}
                            fields={fields}
                            onChange={(next) => onChangeNode(child.id, () => next)}
                            onRemove={() => onRemoveNode(child.id)}
                            getCategories={getCategories}
                            isStatic={isStatic}
                        />
                    ) : (
                        <GroupEditor
                            key={child.id}
                            group={child}
                            fields={fields}
                            depth={depth + 1}
                            onChangeNode={onChangeNode}
                            onRemoveNode={onRemoveNode}
                            onAddChild={onAddChild}
                            getCategories={getCategories}
                            isStatic={isStatic}
                        />
                    )
                )}
            </VStack>
        </Box>
    );
};

/* --------------------------------------------------------------------- */
/* Modal                                                                  */
/* --------------------------------------------------------------------- */

export interface ExpressionBuilderProps {
    isOpen: boolean;
    onClose: () => void;
    fields: FieldDef[];
    initialExpression?: Expression;
    onApply: (expr: Group | undefined) => void;
    getCategories?: (field: string) => Promise<SelectOption[]>;
    isStatic?: boolean;
}

const isEmptyRoot = (g: Group): boolean => g.children.length === 0 && !g.negated;

const ExpressionBuilder: React.FC<ExpressionBuilderProps> = ({
    isOpen, onClose, fields, initialExpression, onApply, getCategories, isStatic,
}) => {
    const [colors] = useAppColors();
    const [root, setRoot] = React.useState<Group>(
        (initialExpression && initialExpression.kind === 'group' ? initialExpression : emptyGroup())
    );

    React.useEffect(() => {
        if (isOpen) {
            setRoot(initialExpression && initialExpression.kind === 'group' ? initialExpression : emptyGroup());
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen]);

    const onChangeNode = (id: string, fn: (n: Expression) => Expression) => {
        setRoot((r) => mapNode(r, id, fn) as Group);
    };
    const onRemoveNode = (id: string) => {
        setRoot((r) => removeChild(r, id));
    };
    const onAddChild = (parentId: string, child: Expression) => {
        setRoot((r) => addChild(r, parentId, child) as Group);
    };

    const errors = React.useMemo(() => (isEmptyRoot(root) ? [] : validate(root, fields)), [root, fields]);

    const preview = React.useMemo(() => {
        if (isEmptyRoot(root)) return { sql: '(no filter)', human: '(no filter)' };
        if (errors.length > 0) return { sql: null, human: toHumanString(root, fields) };
        try {
            const { sql } = toSql(root, fields);
            return { sql, human: toHumanString(root, fields) };
        } catch (e) {
            return { sql: null, human: toHumanString(root, fields) };
        }
    }, [root, fields, errors]);

    const canApply = errors.length === 0;

    const handleApply = () => {
        onApply(isEmptyRoot(root) ? undefined : root);
        onClose();
    };
    const handleClear = () => setRoot(emptyGroup());

    return (
        <Modal isOpen={isOpen} onClose={onClose} size="4xl" scrollBehavior="inside">
            <ModalOverlay />
            <ModalContent
                bgColor={colors.surfaceAlt}
                textColor={colors.fore}
                borderRadius={RADIUS.lg}
                borderColor={colors.border}
                borderWidth={1}
                onMouseDown={stopPropagation}
                onTouchStart={stopPropagation}
            >
                <ModalHeader borderBottomColor={colors.border} borderBottomWidth={1} fontSize={18}>
                    Filter
                </ModalHeader>
                <ModalCloseButton
                    borderWidth={1}
                    borderRadius={RADIUS.lg}
                    borderColor={colors.border}
                    _hover={{ bgColor: colors.surfaceSubtle, color: colors.fore }}
                />
                <ModalBody paddingTop={5}>
                    {fields.length === 0 ? (
                        <Text color={colors.foreHalf}>No fields available - bind a data source first.</Text>
                    ) : (
                        <GroupEditor
                            group={root}
                            fields={fields}
                            depth={0}
                            onChangeNode={onChangeNode}
                            onRemoveNode={onRemoveNode}
                            onAddChild={onAddChild}
                            getCategories={getCategories}
                            isRoot
                            isStatic={isStatic}
                        />
                    )}
                    <Box marginTop={5} borderTopWidth={1} borderTopColor={colors.foreQuarter} paddingTop={3}>
                        <Text fontSize="sm" color={colors.foreHalf} marginBottom={1}>Preview</Text>
                        <Text fontSize="sm" marginBottom={2}>{preview.human}</Text>
                        {preview.sql ? (
                            <Code
                                display="block"
                                whiteSpace="pre-wrap"
                                bg={colors.bgQuarter}
                                color={colors.fore}
                                borderRadius={RADIUS.lg}
                                padding={2}
                                fontSize="xs"
                            >
                                WHERE {preview.sql}
                            </Code>
                        ) : null}
                        {errors.length > 0 ? (
                            <VStack align="stretch" marginTop={2} spacing={0}>
                                {errors.map((e, i) => (
                                    <Text key={i} color={colors.fail} fontSize="sm">{e}</Text>
                                ))}
                            </VStack>
                        ) : null}
                    </Box>
                </ModalBody>
                <ModalFooter>
                    <HStack spacing={2}>
                        <FBButton typ="fail" variant="outline" onClick={onClose}>Cancel</FBButton>
                        <FBButton typ="warning" variant="outline" onClick={handleClear} isDisabled={isStatic}>Clear all</FBButton>
                        <FBButton typ="success" onClick={handleApply} isDisabled={!canApply || isStatic}>Apply</FBButton>
                    </HStack>
                </ModalFooter>
            </ModalContent>
        </Modal>
    );
};

export default ExpressionBuilder;
