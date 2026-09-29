Knowing all the possible step types and knwoing the formulas use PowerFX syntax, come up with a skills file and and agents file that would help
llms generate correct xml and powerfx code for the xml integration files and workbook mapping files. If sepaarte skills and agents file is needed
to separate integration vs workbooks mapping, that is fine. The skills and agents file should help the coding agents determine what values are
good and to point them to a powerfx syntax reference, unless it is bettert to summarize the powerfx syntax and basic formulas inline.

The skills and agents file should also help coding agents know that they can expect the puppyworkbooks cli tool to be available in the system's path so they can call it to run the integrations in mock mode and mappings to verify the xml integration definitions work. Ensure the coding agent understands they can run the integrations in mock mode and how to create mock data for the integrations for testing.