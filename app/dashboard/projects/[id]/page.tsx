import { notFound } from "next/navigation";
import { getHomeProject, computeProjectStats } from "@/lib/project-data";
import { TopBar } from "@/components/layout/top-bar";
import { ProjectDashboard } from "@/components/projects/project-dashboard";

export const revalidate = 0;

export default async function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const project = await getHomeProject(id);
  if (!project) notFound();
  const stats = computeProjectStats(project);

  return (
    <div>
      <TopBar title={`Projects · ${project.name}`} />
      <ProjectDashboard project={project} stats={stats} />
    </div>
  );
}
