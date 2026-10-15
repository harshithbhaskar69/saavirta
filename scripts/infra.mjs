import { productionSecrets, terraformEnvironment, run } from "./cloud-auth.mjs";
try {
  const operation = process.argv[2] ?? "plan";
  if (!["plan", "apply", "outputs"].includes(operation))
    throw new Error("Use plan, apply or outputs");
  const env = await terraformEnvironment(await productionSecrets());
  const terraform = process.env.TERRAFORM_BIN ?? "terraform";
  run(
    terraform,
    [
      "-chdir=infra",
      "init",
      "-reconfigure",
      "-input=false",
      "-backend-config=backend.hcl",
    ],
    { env },
  );
  if (operation === "outputs")
    console.log(
      run(terraform, ["-chdir=infra", "output", "-json"], {
        env,
        capture: true,
      }),
    );
  else
    run(
      terraform,
      [
        "-chdir=infra",
        operation,
        ...(operation === "apply" ? ["-auto-approve"] : []),
        ...process.argv.slice(3),
      ],
      { env },
    );
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
