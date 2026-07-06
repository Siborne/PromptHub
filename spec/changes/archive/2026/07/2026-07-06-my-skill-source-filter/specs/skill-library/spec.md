# Skill Library Source Filter Spec

## ADDED Requirements

### Requirement: Filter My Skills By Source Badge

The My Skills view MUST provide a source dropdown that lists the source badge
groups present in the currently visible candidate set.

#### Scenario: Filter by GitHub import

- Given My Skills contains skills from Claude Code Store, GitHub Import, and an
  Agent import
- When the user selects GitHub Import from the source dropdown
- Then only skills whose primary source badge is GitHub Import are shown

#### Scenario: Combine with existing filters

- Given the user has selected All, Favorites, Distributed, Pending, search, or
  tag filters
- When the source dropdown is opened
- Then its counts are based on the candidate set after those existing filters
- And selecting a source further narrows that set

#### Scenario: Source option disappears

- Given a source filter is active
- When another filter removes that source from the candidate set
- Then the source filter falls back to All Sources
