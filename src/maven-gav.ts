export default class MavenGAVCoords {
  private readonly groupId: string
  private readonly artifactId: string
  private readonly version: string

  constructor(groupId: string, artifactId: string, version: string) {
    this.groupId = groupId
    this.artifactId = artifactId
    this.version = version
  }

  getGroupId(): string {
    return this.groupId
  }
  getArtifactId(): string {
    return this.artifactId
  }
  getVersion(): string {
    return this.version
  }
}
