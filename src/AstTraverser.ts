import { visitorKeys } from '@typescript-eslint/visitor-keys'
import { AST_NODE_TYPES, TSESTree } from '@typescript-eslint/typescript-estree'

type Node = TSESTree.Node

function isValidNode(x: unknown): x is Node {
  return (
    typeof x === 'object' &&
    x !== null &&
    Object.prototype.hasOwnProperty.call(x, 'type') &&
    typeof (x as { type: unknown }).type === 'string'
  )
}

function getVisitorKeysForNode(
  allVisitorKeys: typeof visitorKeys,
  node: Node
): readonly (keyof Node)[] {
  const keys = allVisitorKeys[node.type]
  return (keys ?? []) as never
}

type TraverseOptions = {
  [key in Node['type']]?: (
    this: AstTraverser,
    node: Node,
    parent: Node | undefined
  ) => void
} &
  Partial<{
    enter: (this: AstTraverser, node: Node, parent: Node | undefined) => void
    exit: (this: AstTraverser, node: Node, parent: Node | undefined) => void
  }>

export class AstTraverser {
  private readonly allVisitorKeys = visitorKeys
  private readonly selectors: TraverseOptions
  private readonly setParentPointers: boolean
  private stopped: boolean
  private skipped: boolean

  constructor(selectors: TraverseOptions, setParentPointers = false) {
    this.selectors = selectors
    this.setParentPointers = setParentPointers
    this.stopped = false
    this.skipped = false
  }

  public break(): void {
    this.stopped = true
  }

  public skip(): void {
    this.skipped = true
  }

  public traverse(
    node: unknown,
    parent?: TSESTree.Node | undefined,
    skipChildren = false
  ): void {
    if (!isValidNode(node)) {
      return
    }

    if (parent === undefined) {
      this.stopped = false
    }

    if (this.setParentPointers) {
      node.parent = parent
    }

    const { enter, exit, [node.type]: onSelector } = this.selectors

    this.skipped = false

    if (enter) {
      enter.call(this, node, parent)
    }

    if (onSelector) {
      onSelector.call(this, node, parent)
    }

    if (this.stopped) {
      return
    }

    if (!this.skipped) {
      const keys = getVisitorKeysForNode(this.allVisitorKeys, node)

      for (const key of keys) {
        const childOrChildren = node[key]
        const children = Array.isArray(childOrChildren)
          ? childOrChildren
          : [childOrChildren]

        for (const child of children) {
          if (this.stopped) {
            return
          }

          this.traverse(child, node)
        }
      }
    }

    if (this.stopped) {
      return
    }

    if (exit) {
      exit.call(this, node, parent)
    }
  }
}

export function traverse(root: Node, options: TraverseOptions): void {
  return new AstTraverser(options).traverse(root)
}
