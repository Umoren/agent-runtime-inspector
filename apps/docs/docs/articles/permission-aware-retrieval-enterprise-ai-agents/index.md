# Permission-Aware Retrieval for Enterprise AI Agents

Enterprise AI products are moving into the systems companies already use to run work, including Slack, Drive, Notion, Linear, GitHub, Salesforce, Zendesk, and the internal tools that hold operational memory.

As those systems serve as answer sources, retrieval has to prove more than relevance.

A support lead asking why an enterprise customer is blocked needs an answer grounded in company context, including the support ticket that opened the escalation, the Linear issue tracking the engineering fix, the Slack discussion where the rollout risk was named, and the account note explaining why the customer is commercially sensitive.

The product has to retrieve the context that answers the question; it also has to prove that the current user is allowed to use that context.

That second requirement is the retrieval boundary: this is the line between context that enters the answer path and context that stays out.

Enterprise AI fails adoption when customers cannot trust its retrieval boundary.

## Retrieval Has To Respect The Source Boundary

The retrieval layer has to check access before context reaches the LLM or agent. That is the job of permission-aware retrieval.

When a user asks:

```text
Why is this customer escalation blocked?
```

the answer usually has to be assembled from several places, including the support ticket, the Linear issue, the private Slack discussion, and the account note. Each source carries a different part of the picture: customer pain, engineering status, rollout risk, and commercial impact.

A useful retrieval system finds the context that answers the question, while a trustworthy retrieval system keeps restricted context outside the answer path.

That difference changes the product behavior for each user.

For example, a support lead who belongs to the private Slack channel sees the ticket, the Linear issue, and the Slack-derived context. A teammate outside that channel sees the ticket and the Linear issue, while the Slack-derived context is excluded before the LLM drafts an answer or the agent takes a follow-up action.

This boundary has to sit before generation because the prompt is already part of the answer path. Once restricted context enters the prompt, the product has used it, even if the final response does not quote it directly.

## Derived Knowledge Carries Source Risk

Enterprise AI systems rarely leave source content in its original shape.

Workplace content gets transformed into product objects. For example, Slack discussions produce tasks, meeting transcripts turn into decision records, support tickets feed risk signals, and document sets get compressed into account summaries. By the time a user sees the answer, the raw source is often several steps behind the surface.

That transformation chain often looks like this:

```text
source content -> extracted entity -> summary -> answer -> timeline
```

Every source already has some boundary around it, such as Slack channel membership, Drive folder access, document visibility, issue permissions, or any other rule that decided who had access to the source.

When the system turns that source into a task, decision, summary, or timeline entry, the boundary has to travel with the substance of the content. In this article, I call that carried boundary source permission.

A private Slack message makes this issue concrete. The message says:

```text
We are delaying the rollout because the enterprise customer is blocked by SSO.
```

The system extracts a decision from that message. Later, the decision appears in a project timeline.

The user does not see the original Slack message. Instead, the user sees a derived decision carrying the same sensitive substance.

If the product protects the raw message and loses the source permission on the derived decision, the leak moves one layer downstream.

Permission-aware retrieval keeps the source boundary attached after transformation.

## Sift Made This Concrete

At Sift, we built a Slack-native context engine that turns workplace activity into a context graph.

We represented Slack messages as connected knowledge, including decisions, tasks, risks, timelines, and answer context the product retrieved, summarized, and reasoned over.

That product shape put permissions at the center of the context engine. For example, a message from a private Slack channel gets extracted into a decision; that decision connects to a project stream; the project stream appears in a timeline or answer.

For me, the issue became tangible here:

A decision trace sounds simple: show where a decision came from and how it changed over time. In practice, it forces a harder question. If the decision came from private source context, the trace has to preserve that boundary everywhere the decision appears.

That work gave me the operating claim for this article: enterprise AI products need provenance around context.

The useful record here is provenance: where the knowledge came from. In this case, that record gives the product enough history to answer a permission question:

```text
Which source produced this knowledge, and is the current user allowed to access that source?
```

## Model The Permission Boundary As Relationships

Slack gives the permission model a concrete shape.

In this case, the source system already has the relationships the retrieval layer needs. Channels have members, and extracted knowledge has a source channel. The graph connects those two facts:

```text
(:Decision)-[:SOURCED_FROM]->(:Channel)
(:Person)-[:MEMBER_OF]->(:Channel)
```

The decision points back to the channel it came from; the person points to the channels they belong to. At retrieval time, the query follows those relationships before returning the decision.

With that graph in place, public-channel decisions enter the result. Private-channel decisions enter the result only when the current user has membership in that channel.

Security teams often call this pattern relationship-based access control, or ReBAC. In plain terms, the product answers authorization by checking a relationship path.

In this case, the person asking the question is the subject. The derived decision is the object. The Slack channel sits between them as the source boundary.

The retrieval question turns into:

```text
Does this user have the right relationship to the source boundary of this knowledge?
```

That framing works because the permission check is no longer floating beside the knowledge. It is attached to the path that produced the knowledge.

## Query-Time Filtering Keeps Unauthorized Context Out

In practice, the retrieval query returns entities from public sources and private-channel entities where the current user has channel membership.

The Cypher predicate looks like this:

```cypher
AND NOT EXISTS {
  MATCH (entity)-[:SOURCED_FROM]->(ch:Channel)
  WHERE ch.channel_type = 'private_channel'
    AND NOT EXISTS {
      MATCH (:Person {node_id: $user_id})-[:MEMBER_OF]->(ch)
    }
}
```

Read it from the entity outward.

For each entity, the query asks one question first: did this knowledge come from a private channel? If yes, the query then asks whether the current user belongs to that channel. Without that membership path, the entity stays out of the retrieval result.

Entities from public channels pass through because they do not require the same membership check. Older entities without source edges also pass through during migration periods, where historical data has not been fully tagged yet.

That fallback helps in a growing product. Existing data often predates the permission model; newly extracted entities carry source provenance without forcing an immediate rewrite of the entire graph.

The placement of the check is as important as the predicate itself. It runs before the product assembles model input, so the LLM receives context that has already passed the access boundary.

## Leak Prevention Includes Counts, Timelines, And Metadata

Answer text is the visible leak, but it is rarely the only surface that carries private-source substance. Counts, timelines, summaries, and metadata can reveal the same underlying context in quieter ways.

For instance, a list endpoint hides private decisions, but the count still says five hidden decisions exist. A timeline redacts message content, while the event title reveals the private action. A summary removes the source link and still preserves the sensitive conclusion.

That is why permission-aware retrieval has to cover every surface that carries derived knowledge.

At Sift, this pushed the access check beyond the main list query. Count queries needed the same boundary as list results. ACL fragments had to reference the correct entity variable, because a filter attached to the wrong variable looks present while doing no useful work. Timeline entries from denied private channels needed locked placeholders instead of private content.

The boundary also has to keep up with the organization. People join and leave private channels, so the graph has to refresh those membership edges and keep query-time filtering aligned with current access.

This is the unglamorous part of making retrieval trustworthy: the permission boundary has to survive every place derived knowledge appears.

## Permission-Aware Retrieval Is Product Architecture

For an enterprise AI product, retrieval quality is only half the trust story.

Customers also need proof that the answer was built from context the current user was allowed to access.

In a security review, a customer will hesitate to connect Slack or Drive if the AI product cannot explain how private context stays private. Inside the company, an internal champion loses trust the first time an answer reveals something from a channel they cannot access.

Security teams will ask where permissions are enforced:

```text
before ingestion
before embedding
before retrieval
before generation
after the answer exists
```

The strongest answer is inside the retrieval path itself. Before the product gives context to the LLM, it should know where that context came from and whether the current user has access to the source.

That is the role of source provenance in the context layer: it gives the product a permission boundary to check before using derived knowledge.

This is also part of why I am building Agent Runtime Inspector.

Sift showed me the context side of the problem through the following questions: what did the system retrieve, what did it exclude, and where did the knowledge come from?

ARI takes the same concern into the agent runtime. When an agent uses context to call a tool, ARI asks the following questions: what did the agent know, what was it allowed to do, what did it send, and what got logged?

The same operating principle shows up in both places:

```text
If an AI product transforms customer data, permission checks have to apply to the transformed output too.
```

Permission-aware retrieval is how enterprise AI keeps context useful while preserving the boundaries customers already depend on.
