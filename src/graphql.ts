import {
  DocumentNode,
  FragmentDefinitionNode,
  SelectionSetNode,
  FieldNode,
  FragmentSpreadNode,
  InlineFragmentNode,
} from "graphql";

/**
 * Collects fragment definitions from the parsed GraphQL document.
 * @param {DocumentNode} document - The parsed GraphQL document.
 * @returns {Record<string, FragmentDefinitionNode>} A map of fragment names to their definitions.
 */
export function collectFragmentDefinitions(
  document: DocumentNode
): Record<string, FragmentDefinitionNode> {
  const fragments: Record<string, FragmentDefinitionNode> = {};

  for (const definition of document.definitions) {
    if (definition.kind === "FragmentDefinition") {
      const fragmentDef = definition as FragmentDefinitionNode;
      fragments[fragmentDef.name.value] = fragmentDef;
    }
  }

  return fragments;
}

/**
 * Recursively collects field names from a selection set, including those in nested fragments.
 * @param {SelectionSetNode} selectionSet - The selection set to traverse.
 * @param {Record<string, FragmentDefinitionNode>} fragmentDefinitions - A map of fragment definitions.
 * @returns {string[]} An array of field names.
 */
export function collectFieldNames(
  selectionSet: SelectionSetNode,
  fragmentDefinitions: Record<string, FragmentDefinitionNode>
): string[] {
  const fieldNames: string[] = [];

  for (const selection of selectionSet.selections) {
    if (selection.kind === "Field") {
      const field = selection as FieldNode;
      fieldNames.push(field.name.value);
      if (field.selectionSet) {
        // Recursively collect field names from nested selection sets
        fieldNames.push(
          ...collectFieldNames(field.selectionSet, fragmentDefinitions)
        );
      }
    } else if (selection.kind === "FragmentSpread") {
      const fragmentSpread = selection as FragmentSpreadNode;
      const fragmentName = fragmentSpread.name.value;
      const fragmentDefinition = fragmentDefinitions[fragmentName];
      if (fragmentDefinition) {
        fieldNames.push(
          ...collectFieldNames(
            fragmentDefinition.selectionSet,
            fragmentDefinitions
          )
        );
      }
    } else if (selection.kind === "InlineFragment") {
      const inlineFragment = selection as InlineFragmentNode;
      fieldNames.push(
        ...collectFieldNames(inlineFragment.selectionSet, fragmentDefinitions)
      );
    }
  }

  return fieldNames;
}
