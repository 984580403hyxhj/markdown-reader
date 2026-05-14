import CoreServices
import Darwin
import Foundation
import UniformTypeIdentifiers

let bundleID = "com.stevenxue.markdown-reader" as NSString
let extensions = ["md", "markdown", "mdown", "mkdn", "txt", "csv", "tsv", "xls", "xlsx"]
var contentTypes = Set([
    "net.daringfireball.markdown",
    "public.markdown",
    "public.plain-text",
    "public.comma-separated-values-text",
    "public.tab-separated-values-text",
    "com.microsoft.excel.xls",
    "org.openxmlformats.spreadsheetml.sheet",
])

for fileExtension in extensions {
    if let contentType = UTType(filenameExtension: fileExtension) {
        contentTypes.insert(contentType.identifier)
    }
}

var failed = false
for contentType in contentTypes.sorted() {
    let status = LSSetDefaultRoleHandlerForContentType(
        contentType as NSString,
        LSRolesMask.viewer,
        bundleID
    )

    if status == noErr {
        print("\(contentType): ok")
    } else {
        print("\(contentType): status \(status)")
        failed = true
    }
}

exit(failed ? 1 : 0)
