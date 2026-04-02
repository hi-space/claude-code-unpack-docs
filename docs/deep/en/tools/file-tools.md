# File Tools

File tools are the most frequently used tools in Claude Code, handling all filesystem read and write operations.

## Read

Reads file contents from the local filesystem.

| Property | Value |
|----------|-------|
| Output format | `cat -n` (line numbers starting at 1) |
| Default limit | 2,000 lines from beginning |
| Supports | Text, images (PNG/JPG), PDFs (max 20 pages/request), Jupyter notebooks |

### Key Behaviors
- Can read any file on the machine (assumes provided paths are valid)
- For large files, supports `offset` and `limit` parameters to read specific portions
- PDF handling: Maximum 20 pages per request; for PDFs with more than 10 pages, the `pages` parameter is **required** to specify which pages to read
- Images are presented visually (multimodal capability)
- Jupyter notebooks return all cells with outputs

## Write

Creates new files or completely overwrites existing ones.

| Property | Value |
|----------|-------|
| Mode | Full file overwrite |
| Prerequisite | Must Read file first if it already exists |
| Preference | Use Edit tool for modifications instead |

### Key Behaviors
- Will error if attempting to overwrite a file that hasn't been Read first
- Should only be used for new files or complete rewrites
- The system prefers Edit for modifications (sends only the diff)

## Edit

Performs exact string replacements in existing files.

| Property | Value |
|----------|-------|
| Mode | Exact string replacement |
| Prerequisite | Must Read file first |
| Uniqueness | `old_string` must be unique in file |
| Batch mode | `replace_all: true` for multiple occurrences |

### Key Behaviors
- Fails if `old_string` is not unique (must provide more context to disambiguate)
- Preserves exact indentation from the file
- `replace_all` is useful for variable/function renames across a file
- `new_string` must differ from `old_string`

## Glob

Fast file pattern matching across the codebase.

| Property | Value |
|----------|-------|
| Engine | Native glob matching |
| Patterns | `**/*.js`, `src/**/*.ts`, etc. |
| Sorting | Results sorted by modification time |

### Key Behaviors
- Works with any codebase size
- Preferred over `find` or `ls` commands
- Supports standard glob patterns

## Grep

Content search built on [ripgrep](https://github.com/BurntSushi/ripgrep).

| Property | Value |
|----------|-------|
| Engine | ripgrep (`rg`) |
| Pattern syntax | Full regex |
| Output modes | `content`, `files_with_matches` (default), `count` |
| Default limit | 250 results |

### Output Modes
- **files_with_matches**: Returns only file paths (default)
- **content**: Shows matching lines with optional context (`-A`, `-B`, `-C`)
- **count**: Shows match counts per file

### Key Behaviors
- Supports file type filtering (`type: "js"`, `type: "py"`)
- Supports glob filtering (`glob: "*.tsx"`)
- Multiline matching available with `multiline: true`
- Preferred over shell `grep` or `rg` commands
- Case-insensitive search with `-i` flag

## Tool Selection Rules

The system prompt enforces strict tool selection:

| Task | Use | Don't Use |
|------|-----|-----------|
| Read files | Read | `cat`, `head`, `tail` |
| Edit files | Edit | `sed`, `awk` |
| Create files | Write | `echo >`, heredoc |
| Search files | Glob | `find`, `ls` |
| Search content | Grep | `grep`, `rg` |
