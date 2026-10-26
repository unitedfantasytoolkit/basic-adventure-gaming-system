/**
 * @file Integration tests for the system's web components.
 *
 * These are real custom elements: they only exist once the browser has upgraded
 * them, their content lives in a shadow root, and most of them go and fetch a
 * document by UUID before they render anything. None of that can be exercised
 * without a browser and a live world, which makes them a good fit for Quench and
 * a bad fit for a unit test.
 *
 * The components bundle is built and loaded separately from the system bundle, so
 * these tests also serve as a check that the bundle actually loaded and that
 * every element a template refers to got registered.
 */

import {
  cleanUpDocuments,
  createTestCharacter,
  createTestItem,
} from "../helpers.mjs"

/**
 * The custom elements the sheets actually use.
 *
 * Deliberately a hardcoded list rather than something derived: the point of the
 * check is to notice when a component stops being registered, and a derived list
 * would quietly shrink along with it.
 *
 * `uft-xp-bar`, `uft-prepared-spells` and `bags-action-tile` are registered too,
 * but no template refers to any of them, so there's nothing here worth
 * protecting -- a test would only make dead code harder to delete.
 * @type {string[]}
 */
const REGISTERED_ELEMENTS = ["uft-item-tile", "uft-character-info-meter"]

/**
 * Register the web component test batch.
 * @param {object} quench - The Quench instance
 */
export default function registerComponentTests(quench) {
  quench.registerBatch(
    "basic-adventure-gaming-system.system.components",
    (context) => {
      const { describe, it, assert, after } = context

      /**
       * Find the component in a mounted subtree.
       *
       * Searched for rather than assumed to be the first child, so a test can
       * wrap its component in whatever markup that component needs to read.
       * @param {HTMLElement} root - The element the markup was mounted into
       * @returns {HTMLElement|undefined} The component, if there is one
       */
      const componentIn = (root) =>
        Array.from(root.querySelectorAll("*")).find((element) =>
          REGISTERED_ELEMENTS.includes(element.localName),
        )

      /**
       * Mount some markup in the document and wait for the component in it to
       * finish connecting.
       *
       * `connectedCallback` is async -- it awaits `prepareData()` before it writes
       * anything into the shadow root -- so an assertion made straight after
       * appending would look at an empty element. Every base component announces
       * itself with a `component:connected` event once it's done, which is what
       * this waits on.
       *
       * The listener is attached in the same synchronous block as the markup, so
       * it is always in place before the component's first `await` yields.
       * @param {string} markup - Markup containing exactly one component
       * @param {(component: HTMLElement) => Promise<void>|void} callback - The
       * test, called with the component itself
       * @returns {Promise<void>} Resolves once the callback is done and the
       * markup has been removed again
       */
      const withComponent = async (markup, callback) => {
        const host = document.createElement("div")
        host.style.display = "none"
        document.body.appendChild(host)

        try {
          const connected = new Promise((resolve, reject) => {
            host.innerHTML = markup
            const component = componentIn(host)

            if (!component) {
              reject(new Error(`No known component found in: ${markup}`))
              return
            }

            component.addEventListener("component:connected", () =>
              resolve(component),
            )
          })

          await callback(await connected)
        } finally {
          host.remove()
        }
      }

      describe("Registration", function registration() {
        this.timeout(15000)

        REGISTERED_ELEMENTS.forEach((tagName) => {
          it(`registers <${tagName}>`, () => {
            assert.isFunction(
              customElements.get(tagName),
              `<${tagName}> is used in a template but never registered`,
            )
          })
        })

        it("upgrades an element written into the document", async () => {
          await withComponent(
            `<uft-character-info-meter value="1" max="2"></uft-character-info-meter>`,
            (element) => {
              assert.instanceOf(
                element,
                customElements.get("uft-character-info-meter"),
              )
              assert.isOk(element.shadowRoot, "the shadow root should be open")
            },
          )
        })

        it("adopts its stylesheet rather than inlining one", async () => {
          await withComponent(
            `<uft-character-info-meter value="1" max="2"></uft-character-info-meter>`,
            (element) => {
              assert.isNotEmpty(
                element.shadowRoot.adoptedStyleSheets,
                "component CSS is imported as a constructed stylesheet",
              )
            },
          )
        })
      })

      describe("uft-item-tile", function itemTile() {
        this.timeout(15000)

        after(() => cleanUpDocuments())

        it("renders the item it is pointed at", async () => {
          const item = await createTestItem({ type: "item", name: "Lantern" })

          await withComponent(
            `<uft-item-tile uuid="${item.uuid}"></uft-item-tile>`,
            (element) => {
              const img = element.shadowRoot.querySelector("img")

              assert.isOk(img, "the tile is an icon first and foremost")
              assert.strictEqual(img.getAttribute("alt"), "Lantern")
            },
          )
        })

        it("resolves its uuid to the document", async () => {
          const item = await createTestItem({ type: "item", name: "Lantern" })

          await withComponent(
            `<uft-item-tile uuid="${item.uuid}"></uft-item-tile>`,
            (element) => {
              assert.strictEqual(element.document?.id, item.id)
            },
          )
        })

        it("renders an owned item as readily as a world item", async () => {
          const actor = await createTestCharacter()
          const item = await createTestItem(
            { type: "weapon", name: "Hand Axe" },
            actor,
          )

          await withComponent(
            `<uft-item-tile uuid="${item.uuid}"></uft-item-tile>`,
            (element) => {
              assert.strictEqual(element.document?.id, item.id)
            },
          )
        })

        it("badges a stack with its quantity", async () => {
          const stack = await createTestItem({
            type: "item",
            name: "Arrows",
            system: { quantity: 20 },
          })

          await withComponent(
            `<uft-item-tile uuid="${stack.uuid}"></uft-item-tile>`,
            (element) => {
              const badge = element.shadowRoot.querySelector(".quantity")

              assert.isOk(badge)
              assert.strictEqual(badge.textContent.trim(), "20")
            },
          )
        })

        it("leaves a single item unbadged", async () => {
          const single = await createTestItem({
            type: "item",
            name: "Torch",
            system: { quantity: 1 },
          })

          await withComponent(
            `<uft-item-tile uuid="${single.uuid}"></uft-item-tile>`,
            (element) => {
              assert.isNull(
                element.shadowRoot.querySelector(".quantity"),
                "a quantity of one is just an item",
              )
            },
          )
        })

        it("badges a container with how much is inside it", async () => {
          const actor = await createTestCharacter()
          const bag = await createTestItem(
            {
              type: "item",
              name: "Sack",
              system: { container: { isContainer: true } },
            },
            actor,
          )
          const rope = await createTestItem(
            { type: "item", name: "Rope" },
            actor,
          )
          const chalk = await createTestItem(
            { type: "item", name: "Chalk" },
            actor,
          )

          await rope.addToContainer(bag)
          await chalk.addToContainer(bag)

          await withComponent(
            `<uft-item-tile uuid="${bag.uuid}"></uft-item-tile>`,
            (element) => {
              const count = element.shadowRoot.querySelector(".container-count")

              assert.isOk(count)
              assert.strictEqual(count.textContent.trim(), "2")
            },
          )
        })

        it("leaves an empty container unbadged", async () => {
          const bag = await createTestItem({
            type: "item",
            name: "Empty Sack",
            system: { container: { isContainer: true } },
          })

          await withComponent(
            `<uft-item-tile uuid="${bag.uuid}"></uft-item-tile>`,
            (element) => {
              assert.isNull(
                element.shadowRoot.querySelector(".container-badge"),
              )
            },
          )
        })

        it("renders nothing when its uuid points nowhere", async () => {
          await withComponent(
            `<uft-item-tile uuid="Item.notarealitemid00"></uft-item-tile>`,
            (element) => {
              assert.strictEqual(
                element.shadowRoot.innerHTML.trim(),
                "",
                "a missing document should be quiet, not broken",
              )
            },
          )
        })
      })

      describe("uft-character-info-meter", function infoMeter() {
        this.timeout(15000)

        it("shows the value out of the maximum", async () => {
          await withComponent(
            `<uft-character-info-meter value="4" max="9"></uft-character-info-meter>`,
            (element) => {
              const display = element.shadowRoot.querySelector(".value-display")

              assert.strictEqual(display.textContent.trim(), "4/9")
            },
          )
        })

        it("marks a full meter as full", async () => {
          await withComponent(
            `<uft-character-info-meter value="9" max="9"></uft-character-info-meter>`,
            (element) => {
              const meter = element.shadowRoot.querySelector(".meter")

              assert.isTrue(meter.classList.contains("meter--full"))
              assert.isFalse(meter.classList.contains("meter--empty"))
            },
          )
        })

        it("marks an empty meter as empty", async () => {
          await withComponent(
            `<uft-character-info-meter value="0" max="9"></uft-character-info-meter>`,
            (element) => {
              const meter = element.shadowRoot.querySelector(".meter")

              assert.isTrue(meter.classList.contains("meter--empty"))
            },
          )
        })

        it("keeps a meter over its maximum inside the bar", async () => {
          await withComponent(
            `<uft-character-info-meter value="20" max="9"></uft-character-info-meter>`,
            (element) => {
              const meter = element.shadowRoot.querySelector(".meter")

              assert.include(
                meter.getAttribute("style"),
                "100%",
                "a temporary hit point bonus should not overflow the bar",
              )
            },
          )
        })

        it("offers an input only when it is editable", async () => {
          await withComponent(
            `<uft-character-info-meter value="4" max="9" name="system.hp.value" editable></uft-character-info-meter>`,
            (element) => {
              const input = element.shadowRoot.querySelector(".value-input")

              assert.isOk(input)
              assert.strictEqual(input.name, "system.hp.value")
              assert.strictEqual(input.value, "4")
            },
          )

          await withComponent(
            `<uft-character-info-meter value="4" max="9"></uft-character-info-meter>`,
            (element) => {
              assert.isNull(element.shadowRoot.querySelector(".value-input"))
            },
          )
        })

        it("redraws itself when its value changes", async () => {
          await withComponent(
            `<uft-character-info-meter value="4" max="9"></uft-character-info-meter>`,
            (element) => {
              element.setAttribute("value", "7")

              assert.strictEqual(
                element.shadowRoot
                  .querySelector(".value-display")
                  .textContent.trim(),
                "7/9",
              )
            },
          )
        })
      })
    },
    { displayName: "BAGS: Web components" },
  )
}
