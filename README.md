# magicworld.com

Placeholder home page and index of sites/tools hosted at [magicworld.com](https://magicworld.com).

## Layout

| Path | What |
|---|---|
| `site/` | The website: plain HTML/CSS, no build step. Everything here is published. |
| `infra/dns.yml` | CloudFormation: Route 53 hosted zone + email (GoDaddy/secureserver) records. |
| `infra/site.yml` | CloudFormation: S3 bucket, CloudFront, ACM cert, alias records, GitHub deploy role. |
| `.github/workflows/deploy.yml` | Deploys `site/` to S3 and invalidates CloudFront on every push/merge to `main`. |

## Adding a tool to the index

Copy one of the `<a class="card">` blocks in `site/index.html`, set its `href`, title and
description, and drop the `soon` class and badge. Tools can also live in subfolders
(e.g. `site/my-tool/index.html` → `https://magicworld.com/my-tool/`).

## Workflow

1. `git checkout -b feature/whatever`
2. Edit files in `site/`; preview by opening `site/index.html` in a browser
   (or `python -m http.server -d site`).
3. Push, open a PR, merge to `main` → GitHub Actions deploys within a minute or two.

## How deploys authenticate

GitHub Actions assumes the IAM role `magicworld-github-deploy` via OIDC (no stored AWS keys).
The role trusts only this repo's `main` branch and can only write to the site bucket and
invalidate the distribution. The workflow reads these repo **variables**:

- `AWS_ROLE_ARN`, `S3_BUCKET`, `CF_DISTRIBUTION_ID` (from the `magicworld-site` stack outputs)

## Infrastructure (one-time / rare changes)

Both stacks are in `us-east-1`.

```sh
aws cloudformation deploy --region us-east-1 --stack-name magicworld-dns  --template-file infra/dns.yml
aws cloudformation deploy --region us-east-1 --stack-name magicworld-site --template-file infra/site.yml \
  --capabilities CAPABILITY_NAMED_IAM
```

DNS for the domain is served by Route 53. The domain is still **registered** at GoDaddy (nameservers
point to Route 53). Email is GoDaddy mail: keep the MX/CNAME records in `infra/dns.yml` intact.
