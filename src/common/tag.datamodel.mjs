const {
  SchemaField,
  ArrayField,
  StringField,
  HTMLField,
  FilePathField,
  BooleanField,
} = foundry.data.fields

export default class TagsDataModel extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      tags: new ArrayField(
        new SchemaField({
          img: new FilePathField({
            categories: ["IMAGE"],
            initial: "icons/svg/barrel.svg",
          }),
          id: new StringField(
            {
              initial: "tag:new",
            },
            {
              /**
               * @todo Implement validation: no spaces
               * @todo Implement validation: structure of
               *`category:tag[:subtag?]`
               */
              validate(tag, options) {
                // const { id, name, img } = tag
                // if (!id) return false

                // // Ensure ID follows pattern category:subtype
                // const idPattern = /^[a-z]+:[a-z-]+$/
                // if (!idPattern.test(id)) return false

                return true
              },
            },
          ),
          name: new StringField({}),
          description: new HTMLField({}),
          transfer: new BooleanField({ initial: false }),
        }),
        {
          /**
           * @todo implement validation: duplicate tags
           */
          validate(tags, options) {
            const dedupedTags = tags.reduce((arr, tag) => {
              if (arr.some((t) => t.id === tag.id)) return arr
              return [...arr, tag]
            }, [])
            console.info(dedupedTags, options)
            return true
          },
        },
      ),
    }
  }
}
