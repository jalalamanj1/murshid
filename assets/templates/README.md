Place document templates (.docx) in this directory.

Each record type has its own subdirectory:

  assets/templates/
    study-case/             study-case.docx
    counseling-session/     counseling-session.docx
    behavior-report/        behavior-report.docx
    health-record/          health-record.docx
    letter/                 letter.docx

The TemplateManager loads templates from these directories
by record type. The original template file is never modified —
a copy is created for each use.

Placeholders in templates use the format {{PLACEHOLDER_NAME}}.
These will be replaced dynamically when generating documents.
