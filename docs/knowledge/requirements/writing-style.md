# Writing Style Requirements

All documentation in this project should be written for speed reading. This means flowing prose that works when processed word-by-word through auditory processing, not visual scanning.

## The Core Rule

Write as if you're explaining something to a colleague out loud. If you wouldn't say it that way in conversation, don't write it that way.

## What to Do

Use flowing prose with complete sentences that build on each other. Each word should lead naturally to the next, creating momentum that carries the reader forward.

Write in active voice because it creates forward momentum. The subject does something, and you follow the action naturally. So instead of "the backup job is triggered at midnight by the scheduler," write "the scheduler triggers the backup job at midnight."

Use transitions and connectives like "because," "however," "then," "so," and "which means" to help the reader anticipate what's coming next. They're the verbal equivalent of road signs.

Lead with context by telling the reader why before telling them what. This primes the brain to receive and organize the information that follows.

Keep one idea per sentence. Complex sentences with multiple clauses force the reader to hold too much in working memory, so split them up.

Use pronouns to avoid tedious repetition. Instead of repeating "the AuthService" four times, say "it" after establishing what you're talking about.

## What to Avoid

Don't use bullet lists. They rely on spatial positioning to convey relationships, but when flattened into a word stream they become disconnected fragments. Instead of listing features as bullets, write "the system handles user authentication and enforces role-based permissions, so each user only sees what they're allowed to access."

Don't use headers as standalone content. Headers work visually because you can see the section they introduce, but in a word stream they appear as orphaned fragments. Instead of a "## Installation" header followed by "run npm install," write "to install the project, run npm install in the root directory."

Don't use telegraphic style that drops articles and verbs. Writing "check logs, find error, fix config" might save space but creates choppy, unnatural reading. Write "start by checking the logs to find the specific error message, then fix the corresponding config value."

Don't use tables. Tables convey relationships through spatial positioning, and that information disappears entirely when read word-by-word.

Don't use parenthetical asides. Parentheses break the flow of reading, and by the time you reach the closing parenthesis you've lost the thread of the main sentence.

## Practical Patterns

When explaining code changes, instead of listing "added null check, updated return type, added test," write "I added a null check to getUserById so it returns null instead of throwing when the user doesn't exist, and I added a test to verify the null case works correctly."

When describing architecture, instead of a bulleted list of technologies, write "the frontend is built with React and talks to an Express API server, with data living in PostgreSQL and Redis sitting in front as a cache."

When documenting procedures, instead of numbered steps, write "to deploy, start by pulling the latest main branch and running the tests, then build the Docker image and push it to the registry, and finally update the version tag in the Kubernetes manifest and apply it to the cluster."

## When to Break the Rules

Code blocks are fine because they're not prose. The reader expects to slow down and parse them differently.

Very short reference tables (like two columns with three rows) can work if they're truly reference material that readers will scan, not narrative content.

Task lists in the DAG file are fine because that's structured data for machines, not prose for humans.

## Summary

Write the way people talk. Use complete sentences, active voice, and natural transitions. Avoid visual structures like bullets and tables that lose their meaning when read word-by-word. When in doubt, read your writing out loud, and if it sounds choppy or unnatural, rewrite it.
