module.exports = [
  {
    category: "Mobile development",
    notes: [
      ["Android", "Android app development, platform components, and mobile APIs."],
      ["iOS", "iOS application development, platform frameworks, and Apple mobile APIs."],
      ["React Native", "Cross-platform mobile apps with React Native components and APIs."],
    ],
  },
  {
    category: "Frontend & web frameworks",
    notes: [
      ["Angular 2", "Angular components, templates, services, and application structure."],
      ["AngularJS", "AngularJS modules, scopes, directives, and application patterns."],
      ["jQuery", "DOM selection, events, effects, and AJAX with jQuery."],
      ["TypeScript", "Typed JavaScript, interfaces, classes, generics, and tooling."],
    ],
  },
  {
    category: "Backend & application frameworks",
    notes: [
      [".NET Framework", ".NET Framework concepts, libraries, and application development."],
      ["Entity Framework", "Object-relational mapping and data access with Entity Framework."],
      ["Hibernate", "Java persistence, ORM mappings, and database access with Hibernate."],
      ["Ruby on Rails", "Rails conventions, models, controllers, routes, and web applications."],
      ["Spring Framework", "Spring dependency injection, web applications, and framework features."],
    ],
  },
  {
    category: "Programming languages",
    notes: [
      ["C", "C language fundamentals, memory, pointers, and standard library references."],
      ["C++", "C++ language features, object-oriented programming, and standard library."],
      ["C#", "C# syntax, types, object-oriented programming, and .NET development."],
      ["Haskell", "Functional programming concepts, types, and Haskell language syntax."],
      ["Kotlin", "Kotlin language fundamentals, classes, functions, and collections."],
      ["Objective-C", "Objective-C syntax, objects, and Apple platform development concepts."],
      ["Perl", "Perl syntax, regular expressions, data structures, and scripting."],
      ["PHP", "PHP language fundamentals, web programming, and common APIs."],
      ["R", "R language basics, data manipulation, and statistical computing."],
      ["Ruby", "Ruby syntax, objects, collections, blocks, and language features."],
      ["Swift", "Swift syntax, types, protocols, and application development concepts."],
    ],
  },
  {
    category: "Databases",
    notes: [
      ["Microsoft SQL Server", "SQL Server queries, database objects, and administration concepts."],
      ["Oracle Database", "Oracle SQL, database features, and Oracle-specific references."],
      ["PostgreSQL", "PostgreSQL queries, data types, indexes, and database features."],
    ],
  },
  {
    category: "Shell & operating systems",
    notes: [
      ["Bash", "Bash shell syntax, command-line workflows, and scripting."],
      ["Linux", "Linux commands, permissions, processes, and system concepts."],
      ["PowerShell", "PowerShell commands, pipelines, objects, and scripting."],
    ],
  },
  {
    category: "Scientific computing & typesetting",
    notes: [
      ["LaTeX", "LaTeX document structure, mathematical notation, and typesetting."],
      ["MATLAB", "MATLAB syntax, matrices, numerical computing, and plotting."],
    ],
  },
].map((group) => ({
  ...group,
  notes: group.notes.map(([technology, description]) => {
    const slugByTechnology = {
      ".NET Framework": "dotnetframework",
      "C++": "cplusplus",
      "C#": "csharp",
      R: "r",
    };
    const slug = slugByTechnology[technology] || technology.toLowerCase().replace(/[^a-z0-9]+/g, "");
    const filename = `${slug}-notes-for-professionals.pdf`;
    return {
      technology,
      description,
      filename,
      url: `/downloads/resources/${filename}`,
    };
  }),
}));
